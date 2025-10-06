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
import BluetoothService from '../services/BluetoothService';

export default function LogScreen() {
  const [watchLogs, setWatchLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);

  useEffect(() => {
    const unsubscribe = BluetoothService.subscribe(handleBluetoothData);
    checkConnection();

    return () => {
      unsubscribe();
    };
  }, []);

  const checkConnection = async () => {
    try {
      const status = BluetoothService.getConnectionStatus();
      
      if (status.isConnected && status.device) {
        setConnectedDevice(status.device);
      } else {
        setConnectedDevice(null);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleBluetoothData = async (data) => {
    switch (data.type) {
      case 'LOGS_DATA':
        setWatchLogs(data.logs.map((log, index) => ({
          ...log,
          id: `${Date.now()}_${index}`
        })));
        Alert.alert('Synced', `${data.logs.length} logs received from watch`);
        break;
        
      case 'SUCCESS':
        if (data.command === 'CLEAR_LOGS') {
          setWatchLogs([]);
          Alert.alert('Cleared', 'Logs removed from watch');
        }
        break;
        
      case 'ERROR':
        Alert.alert('Error', data.message);
        break;

      case 'DISCONNECTED':
        setConnectedDevice(null);
        Alert.alert('Disconnected', 'Watch connection lost');
        break;
    }
  };

  const clearAllLogs = async () => {
    if (!connectedDevice) {
      Alert.alert('Not Connected', 'Please connect to your watch first');
      return;
    }

    Alert.alert(
      'Clear Watch Logs',
      'Remove all medication logs from your watch?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await BluetoothService.clearLogs();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear logs: ' + error.message);
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
    await checkConnection();
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

  const getActionIcon = (action) => {
    switch (action?.toLowerCase()) {
      case 'taken':
        return 'checkmark-circle';
      case 'snoozed':
        return 'time';
      case 'missed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const renderLog = ({ item, index }) => (
    <View style={styles.logCard}>
      <View style={styles.cardHeader}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <View style={styles.medicationInfo}>
          <Text style={styles.medicationName}>{item.medication}</Text>
          <Text style={styles.dosageText}>{item.dosage}</Text>
        </View>
        <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) }]}>
          <Ionicons name={getActionIcon(item.action)} size={16} color="white" />
          <Text style={styles.actionText}>{item.action}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        {item.snooze_count !== undefined && item.snooze_count > 0 && (
          <View style={styles.infoChip}>
            <Ionicons name="alarm-outline" size={13} color="#f59e0b" />
            <Text style={styles.infoChipText}>{item.snooze_count}x snoozed</Text>
          </View>
        )}
        <View style={styles.infoChip}>
          <Ionicons name="time-outline" size={13} color="#6b7280" />
          <Text style={styles.infoChipText}>
            {item.datetime || formatDateTime(item.timestamp)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Connection Status Banner */}
      {!connectedDevice && (
        <View style={styles.statusBanner}>
          <View style={styles.statusContent}>
            <Ionicons name="bluetooth-outline" size={20} color="#f59e0b" />
            <Text style={styles.statusText}>Watch not connected</Text>
          </View>
        </View>
      )}

      {connectedDevice && (
        <View style={[styles.statusBanner, styles.connectedBanner]}>
          <View style={styles.statusContent}>
            <Ionicons name="bluetooth" size={20} color="#10b981" />
            <Text style={[styles.statusText, styles.connectedText]}>
              {connectedDevice.name || 'Watch connected'}
            </Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Medication Logs</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{watchLogs.length} entries</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={onRefresh} 
          disabled={isLoading}
          style={styles.refreshBtn}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#9D4EDD" />
          ) : (
            <Ionicons name="reload" size={24} color="#9D4EDD" />
          )}
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.clearButton,
            (!connectedDevice || isLoading) && styles.buttonDisabled
          ]}
          onPress={clearAllLogs}
          disabled={!connectedDevice || isLoading}
        >
          <Ionicons name="trash-outline" size={18} color="white" />
          <Text style={styles.buttonText}>Clear Watch Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#9D4EDD" />
        <Text style={styles.infoCardText}>
          Press "PUSH TO APP" on your watch to sync medication logs
        </Text>
      </View>

      {/* Logs List */}
      <FlatList
        data={watchLogs}
        renderItem={renderLog}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#9D4EDD']}
            tintColor="#9D4EDD"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No logs yet</Text>
            <Text style={styles.emptySubtext}>
              {!connectedDevice
                ? 'Connect your watch and press "PUSH TO APP" to view medication logs'
                : 'Press "PUSH TO APP" on your watch to sync logs'
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
    backgroundColor: '#f5f5f7',
  },
  statusBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  connectedBanner: {
    backgroundColor: '#d1fae5',
    borderBottomColor: '#a7f3d0',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  connectedText: {
    color: '#065f46',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  countBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9D4EDD',
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'white',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  clearButton: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f3e8ff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: '#6b21a8',
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingTop: 20,
  },
  logCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  dosageText: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  actionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  infoChipText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
});
