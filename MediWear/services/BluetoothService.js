import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import base64 from 'react-native-base64';

// YOUR GENERATED UUIDs - Replace these with your actual UUIDs
const SERVICE_UUID = 'cba77667-81ff-45c8-ab64-ae8599e50373';
const CHARACTERISTIC_UUID = '5d01e477-2544-4eae-ab60-386888dedad6';

class BluetoothService {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.isConnected = false;
    this.listeners = [];
    this.buffer = '';
  }

  // Request necessary permissions (Android)
  async requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 11 and below
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  }

  // Check if Bluetooth is enabled
  async isBluetoothEnabled() {
    try {
      const state = await this.manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth status:', error);
      return false;
    }
  }

  // Start scanning for devices
  async startScan(onDeviceFound, onError) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Bluetooth permissions not granted');
      }

      const isEnabled = await this.isBluetoothEnabled();
      if (!isEnabled) {
        throw new Error('Bluetooth is not enabled');
      }

      console.log('Starting BLE scan...');

      this.manager.startDeviceScan(
        null, // Scan for all devices, or use [SERVICE_UUID] to filter
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            onError(error);
            return;
          }

          if (device && device.name) {
            console.log('Found device:', device.name, device.id);
            onDeviceFound({
              id: device.id,
              name: device.name,
              rssi: device.rssi,
            });
          }
        }
      );
    } catch (error) {
      console.error('Error starting scan:', error);
      onError(error);
    }
  }

  // Stop scanning
  stopScan() {
    this.manager.stopDeviceScan();
    console.log('Stopped scanning');
  }

  // Connect to device
  async connectToDevice(deviceId) {
    try {
      console.log('Connecting to device:', deviceId);

      // Connect to device
      this.device = await this.manager.connectToDevice(deviceId, {
        requestMTU: 512,
      });

      console.log('Connected, discovering services...');

      // Discover all services and characteristics
      await this.device.discoverAllServicesAndCharacteristics();

      console.log('Services discovered');

      this.isConnected = true;
      this.buffer = '';

      // Setup disconnect listener
      this.device.onDisconnected((error, device) => {
        console.log('Device disconnected:', device?.name);
        this.isConnected = false;
        this.device = null;
        this.notifyListeners({ type: 'DISCONNECTED' });
      });

      // Start listening for notifications
      this.startListening();

      return this.device;
    } catch (error) {
      console.error('Connection error:', error);
      this.isConnected = false;
      this.device = null;
      throw error;
    }
  }

  // Start listening for incoming data
  startListening() {
    if (!this.device) return;

    console.log('Setting up characteristic monitoring...');

    this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('Monitor error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            // Decode base64 data
            const decoded = base64.decode(characteristic.value);
            
            // Append to buffer
            this.buffer += decoded;
            
            // Process complete lines (JSON messages end with newline)
            const lines = this.buffer.split('\n');
            
            // Keep the last incomplete line in buffer
            this.buffer = lines.pop() || '';
            
            // Process complete lines
            lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed) {
                this.processMessage(trimmed);
              }
            });
          } catch (error) {
            console.error('Error processing data:', error);
          }
        }
      }
    );
  }

  // Process a JSON message from device
  processMessage(message) {
    try {
      const json = JSON.parse(message);
      
      console.log('📨 Received:', json.cmd || json.status);
      
      if (json.cmd === 'LOGS_DATA') {
        this.notifyListeners({ 
          type: 'LOGS_DATA', 
          logs: json.data?.logs || [] 
        });
      } else if (json.cmd === 'MEDS_DATA') {
        this.notifyListeners({ 
          type: 'MEDS_DATA', 
          medications: json.medications || [] 
        });
      } else if (json.cmd === 'SYNC_RESPONSE') {
        this.notifyListeners({ 
          type: 'SYNC_RESPONSE', 
          success: json.success,
          message: json.message 
        });
      } else if (json.status === 'success') {
        this.notifyListeners({ 
          type: 'SUCCESS', 
          command: json.cmd 
        });
      } else if (json.status === 'error') {
        this.notifyListeners({ 
          type: 'ERROR', 
          message: json.message 
        });
      } else if (json.status === 'pong') {
        console.log('💓 Device alive');
      } else if (json.cmd === 'PING') {
        this.sendCommand({ status: 'pong' });
      }
    } catch (error) {
      console.error('Error parsing JSON:', error, 'Message:', message);
    }
  }

  // Disconnect from device
  async disconnectFromDevice(deviceId) {
    try {
      if (this.device && this.device.id === deviceId) {
        await this.device.cancelConnection();
        this.device = null;
        this.isConnected = false;
        this.buffer = '';
        console.log('✓ Disconnected');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  }

  // Get connected devices
  async getConnectedDevices() {
    try {
      if (this.device && this.isConnected) {
        const isConnected = await this.device.isConnected();
        if (isConnected) {
          return [this.device];
        }
      }
      return [];
    } catch (error) {
      console.error('Error getting connected devices:', error);
      return [];
    }
  }

  // Monitor device connection
  monitorDeviceConnection(deviceId, callback) {
    // Return subscription that can be removed
    return {
      remove: () => {
        console.log('Removed connection monitor');
      }
    };
  }

  // Send JSON command to device
  async sendCommand(command) {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to device');
    }

    try {
      const json = JSON.stringify(command);
      const encoded = base64.encode(json + '\n');
      
      await this.device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        encoded
      );
      
      console.log('📤 Sent:', command.cmd || command.status);
    } catch (error) {
      console.error('Error sending command:', error);
      throw error;
    }
  }

  // Request logs from device
  async requestLogs() {
    await this.sendCommand({ cmd: 'GET_LOGS' });
  }

  // Request medications from device
  async requestMedications() {
    await this.sendCommand({ cmd: 'GET_MEDS' });
  }

  // Add medication
  async addMedication(medication) {
    await this.sendCommand({
      cmd: 'ADD_MED',
      name: medication.name,
      dosage: medication.dosage,
      hour: medication.hour,
      minute: medication.minute,
      frequency: medication.frequency,
      days: medication.days
    });
  }

  // Update medication
  async updateMedication(medication) {
    await this.sendCommand({
      cmd: 'UPDATE_MED',
      id: medication.id,
      name: medication.name,
      dosage: medication.dosage,
      hour: medication.hour,
      minute: medication.minute,
      active: medication.active
    });
  }

  // Delete medication
  async deleteMedication(id) {
    await this.sendCommand({
      cmd: 'DELETE_MED',
      id: id
    });
  }

  // Sync time with device
  async syncTime(dateTime) {
    await this.sendCommand({
      cmd: 'SYNC_TIME',
      hour: dateTime.hour,
      minute: dateTime.minute,
      second: dateTime.second,
      day: dateTime.day,
      month: dateTime.month,
      year: dateTime.year,
      day_of_week: dateTime.day_of_week
    });
  }

  // Clear logs on device
  async clearLogs() {
    await this.sendCommand({ cmd: 'CLEAR_LOGS' });
  }

  // Send ping
  async ping() {
    await this.sendCommand({ cmd: 'PING' });
  }

  // Sync single medication to device
  async syncMedicationToDevice(medicineData) {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to device');
    }
    
    try {
      // Convert 12-hour format to 24-hour
      const convertTo24Hour = (timeStr) => {
        const [time, meridiem] = timeStr.split(' ');
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours, 10);
        
        if (meridiem === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (meridiem === 'AM' && hour24 === 12) {
          hour24 = 0;
        }
        
        return { hour: hour24, minute: parseInt(minutes, 10) };
      };

      // Send SYNC_MED command with all medication details
      const firstTime = convertTo24Hour(medicineData.reminderTimes[0]);
      
      await this.sendCommand({
        cmd: 'SYNC_MED',
        name: medicineData.name,
        dosage: medicineData.dosage,
        hour: firstTime.hour,
        minute: firstTime.minute,
        frequency: medicineData.frequency,
        days: medicineData.days,
        takeWithFood: medicineData.takeWithFood || false,
        specialInstructions: medicineData.specialInstructions || '',
        allTimes: medicineData.reminderTimes
      });
      
      console.log('📤 Sync request sent to device');
      
      // Wait for device confirmation (with timeout)
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Device confirmation timeout'));
        }, 30000); // 30 second timeout
        
        const listener = (data) => {
          if (data.type === 'SYNC_RESPONSE') {
            clearTimeout(timeout);
            this.listeners = this.listeners.filter(cb => cb !== listener);
            resolve(data);
          }
        };
        
        this.subscribe(listener);
      });
      
    } catch (error) {
      console.error('Error syncing medication:', error);
      throw error;
    }
  }

  // Subscribe to data events
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners
  notifyListeners(data) {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in listener callback:', error);
      }
    });
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      device: this.device ? {
        name: this.device.name,
        id: this.device.id
      } : null
    };
  }
}

export default new BluetoothService();
