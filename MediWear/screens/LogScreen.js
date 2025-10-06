import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import BluetoothService from '../services/BluetoothService';

export default function LogScreen() {
  const [watchLogs, setWatchLogs] = useState([]);
  const [appLogs, setAppLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('watch'); // 'watch' or 'app'
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);

  useEffect(() => {
    console.log('LogScreen mounted');
    
    const initialize = async () => {
      await MedicationLogService.initialize();
    };
    
    initialize();

    const unsubscribe = BluetoothService.subscribe(handleBluetoothData);
    checkConnection();

    // Subscribe to watch logs
    const unsubscribeWatchLogs = MedicationLogService.subscribeToWatchLogs(setWatchLogs);
    
    // Subscribe to app logs
    const unsubscribeAppLogs = MedicationLogService.subscribeToAppLogs(setAppLogs);

    return () => {
      console.log('LogScreen unmounted');
      unsubscribe();
      unsubscribeWatchLogs();
      unsubscribeAppLogs();
    };
  }, []);

  const checkConnection = async () => {
    try {
      const status = BluetoothService.getConnectionStatus();
      console.log('Connection status:', status);
      
      if (status.isConnected && status.device) {
        setConnectedDevice(status.device);
        console.log('Device connected:', status.device.name);
      } else {
        console.log('No device connected');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleBluetoothData = async (data) => {
    console.log('Received data:', data.type);
    
    switch (data.type) {
      case 'LOGS_DATA':
        console.log('Processing logs:', data.logs.length, 'items');
        try {
          const result = await MedicationLogService.saveWatchLogs(data.logs);
          Alert.alert('Success', `Synced ${result.count} logs to cloud`);
        } catch (error) {
          Alert.alert('Error', 'Failed to sync logs: ' + error.message);
        }
        break;
        
      case 'SUCCESS':
        console.log('Command success:', data.command);
        if (data.command === 'CLEAR_LOGS') {
          Alert.alert('Success', 'Logs cleared on device');
        }
        break;
        
      case 'ERROR':
        console.log('Error received:', data.message);
        Alert.alert('Error', data.message);
        break;

      case 'DISCONNECTED':
        console.log('Device disconnected');
        setConnectedDevice(null);
        Alert.alert('Disconnected', 'Device has been disconnected');
        break;
    }
  };

  const clearAllLogs = async () => {
    const logType = activeTab === 'watch' ? 'watch' : 'app';
    const logTypeName = activeTab === 'watch' ? 'Watch' : 'App';
    
    Alert.alert(
      `Clear ${logTypeName} Logs`,
      `This will permanently delete ALL ${logTypeName.toLowerCase()} logs from the cloud. This cannot be undone. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await MedicationLogService.clearAllLogs(logType);
              
              // Also clear on device if watch logs and device is connected
              if (logType === 'watch' && connectedDevice) {
                await BluetoothService.clearLogs();
              }
              
              Alert.alert('Success', `Deleted ${result.count} ${logTypeName.toLowerCase()} logs from cloud`);
            } catch (error) {
              console.error('Error deleting logs:', error);
              Alert.alert('Error', 'Failed to delete logs: ' + error.message);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Firestore real-time listener will automatically update
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getActionColor = (action) => {
    switch (action?.toLowerCase()) {
      case 'taken':
        return '#10b981';
      case 'snoozed':
        return '#f59e0b';
      case 'missed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const renderLog = ({ item, index }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logBadge}>
          <Text style={styles.logNumber}>#{index + 1}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.medicationName}>{item.medication}</Text>
          <Text style={styles.dosage}>{item.dosage}</Text>
        </View>
        <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) }]}>
          <Text style={styles.actionText}>{item.action}</Text>
        </View>
      </View>

      <View style={styles.logFooter}>
        {activeTab === 'watch' && item.snooze_count !== undefined && (
          <View style={styles.infoRow}>
            <Ionicons name="repeat-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>Snooze: {item.snooze_count}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons 
            name={activeTab === 'watch' ? 'watch-outline' : 'phone-portrait-outline'} 
            size={14} 
            color="#6b7280" 
          />
          <Text style={styles.infoText}>
            {activeTab === 'watch' ? 'From Watch' : 'From App'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.infoText}>
            {item.datetime || formatDateTime(item.timestamp)}
          </Text>
        </View>
      </View>

      {activeTab === 'app' && item.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Note:</Text>
          <Text style={styles.notesText}>{item.notes}</Text>
        </View>
      )}

      {activeTab === 'app' && item.status && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {item.status === 'late' ? '⏰ Taken Late' : '✓ On Time'}
          </Text>
        </View>
      )}
    </View>
  );

  const currentLogs = activeTab === 'watch' ? watchLogs : appLogs;
  const totalLogs = activeTab === 'watch' ? watchLogs.length : appLogs.length;

  return (
    <View style={styles.container}>
      {/* Connection Status Banner - Only show for watch tab */}
      {activeTab === 'watch' && !connectedDevice && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={20} color="#92400e" />
          <Text style={styles.warningText}>No device connected</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Medication Logs</Text>
          <Text style={styles.subtitle}>
            {activeTab === 'watch' 
              ? connectedDevice 
                ? `Connected: ${connectedDevice.name || 'Device'}`
                : 'Not connected'
              : 'Logged from app'
            }
          </Text>
          <Text style={styles.subtitle}>Total: {totalLogs} logs</Text>
        </View>
        <TouchableOpacity 
          onPress={onRefresh} 
          disabled={isLoading}
          style={styles.refreshBtn}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#9D4EDD" />
          ) : (
            <Ionicons name="cloud-outline" size={24} color="#9D4EDD" />
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'watch' && styles.activeTab]}
          onPress={() => setActiveTab('watch')}
        >
          <Ionicons 
            name="watch-outline" 
            size={20} 
            color={activeTab === 'watch' ? '#9D4EDD' : '#6b7280'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'watch' && styles.activeTabText
          ]}>
            Watch Logs
          </Text>
          <View style={[
            styles.badge,
            activeTab === 'watch' && styles.activeBadge
          ]}>
            <Text style={[
              styles.badgeText,
              activeTab === 'watch' && styles.activeBadgeText
            ]}>
              {watchLogs.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'app' && styles.activeTab]}
          onPress={() => setActiveTab('app')}
        >
          <Ionicons 
            name="phone-portrait-outline" 
            size={20} 
            color={activeTab === 'app' ? '#9D4EDD' : '#6b7280'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'app' && styles.activeTabText
          ]}>
            App Logs
          </Text>
          <View style={[
            styles.badge,
            activeTab === 'app' && styles.activeBadge
          ]}>
            <Text style={[
              styles.badgeText,
              activeTab === 'app' && styles.activeBadgeText
            ]}>
              {appLogs.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.dangerBtn, isLoading && styles.btnDisabled]}
          onPress={clearAllLogs}
          disabled={isLoading}
        >
          <Ionicons name="trash-outline" size={18} color="white" />
          <Text style={styles.btnText}>
            Delete All {activeTab === 'watch' ? 'Watch' : 'App'} Logs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={[
        styles.infoBanner,
        activeTab === 'app' && styles.infoBannerBlue
      ]}>
        <Ionicons 
          name={activeTab === 'watch' ? 'cloud-done-outline' : 'phone-portrait-outline'} 
          size={16} 
          color={activeTab === 'watch' ? '#10b981' : '#3b82f6'} 
        />
        <Text style={[
          styles.infoTextGreen,
          activeTab === 'app' && styles.infoTextBlue
        ]}>
          {activeTab === 'watch' 
            ? 'Auto-synced to cloud • Press "PUSH TO APP" on device to sync'
            : 'Medications you marked as taken in the app'
          }
        </Text>
      </View>

      {/* Logs List */}
      <FlatList
        data={currentLogs}
        renderItem={renderLog}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#9D4EDD']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons 
              name={activeTab === 'watch' ? 'cloud-offline-outline' : 'document-text-outline'} 
              size={80} 
              color="#d1d5db" 
            />
            <Text style={styles.emptyText}>
              No {activeTab === 'watch' ? 'watch' : 'app'} logs
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'watch'
                ? !connectedDevice
                  ? 'Connect to device and press "PUSH TO APP" to sync logs'
                  : 'Press "PUSH TO APP" on your device to sync logs'
                : 'Medications you mark as taken in the app will appear here'
              }
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fbbf24',
  },
  warningText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#9D4EDD',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#9D4EDD',
  },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  activeBadge: {
    backgroundColor: '#f3e8ff',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  activeBadgeText: {
    color: '#9D4EDD',
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  dangerBtn: {
    backgroundColor: '#ef4444',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  infoBanner: {
    backgroundColor: '#d1fae5',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoBannerBlue: {
    backgroundColor: '#dbeafe',
  },
  infoTextGreen: {
    fontSize: 12,
    color: '#065f46',
    flex: 1,
  },
  infoTextBlue: {
    color: '#1e40af',
  },
  listContent: {
    padding: 16,
  },
  logCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#9D4EDD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  logBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  flex1: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  dosage: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
  },
  notesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#374151',
  },
  statusBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});