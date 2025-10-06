import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import LoggingService from '../services/LoggingService'; 

const DevLogs = ({ navigation }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollViewRef = useRef(null);

  const logCategories = {
    taken: { 
      color: '#4CAF50', 
      icon: 'check-circle', 
      label: 'Taken',
      description: 'Medicine marked as taken'
    },
    missed: { 
      color: '#F44336', 
      icon: 'cancel', 
      label: 'Missed',
      description: 'Missed or late doses'
    },
    notifications: { 
      color: '#2196F3', 
      icon: 'notifications-active', 
      label: 'Notifications',
      description: 'Notification events'
    },
    system: { 
      color: '#757575', 
      icon: 'settings', 
      label: 'System',
      description: 'System operations'
    },
  };

  useEffect(() => {
    loadLogsFromStorage();
    
    const interval = setInterval(() => {
      loadLogsFromStorage();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadLogsFromStorage = async () => {
    try {
      const storedLogs = await LoggingService.getLogs();
      setLogs(storedLogs.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      ));
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const filteredLogs = logs.filter(log => 
    filter === 'all' || log.category === filter
  );

  const clearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await LoggingService.clearLogs();
            setLogs([]);
          },
        },
      ]
    );
  };

  const exportLogs = async () => {
    try {
      const logText = logs
        .map(log => `[${new Date(log.timestamp).toLocaleString()}] ${log.category.toUpperCase()}: ${log.message}\n${log.details || ''}\n`)
        .join('\n');

      await Share.share({
        message: logText,
        title: 'Medication Reminder Logs',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export logs');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
    });
  };

  useEffect(() => {
    if (autoScroll && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [logs, autoScroll]);

  const renderFilterButton = (filterType, label, icon) => {
    const categoryInfo = logCategories[filterType];
    return (
      <TouchableOpacity
        key={filterType}
        style={[
          styles.filterButton,
          filter === filterType && styles.filterButtonActive,
          filter === filterType && { 
            borderColor: categoryInfo?.color || '#9D4EDD',
            backgroundColor: `${categoryInfo?.color || '#9D4EDD'}10`
          }
        ]}
        onPress={() => setFilter(filterType)}
      >
        {icon && (
          <MaterialIcons 
            name={icon} 
            size={18} 
            color={filter === filterType ? (categoryInfo?.color || '#9D4EDD') : '#757575'} 
          />
        )}
        <Text style={[
          styles.filterButtonText,
          filter === filterType && styles.filterButtonTextActive,
          filter === filterType && { color: categoryInfo?.color || '#9D4EDD' }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={exportLogs}
        >
          <MaterialIcons name="share" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{logs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
            {logs.filter(l => l.category === 'taken').length}
          </Text>
          <Text style={styles.statLabel}>Taken</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F44336' }]}>
            {logs.filter(l => l.category === 'missed').length}
          </Text>
          <Text style={styles.statLabel}>Missed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#2196F3' }]}>
            {logs.filter(l => l.category === 'notifications').length}
          </Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {renderFilterButton('all', 'All', 'list')}
        {renderFilterButton('taken', 'Taken', 'check-circle')}
        {renderFilterButton('missed', 'Missed', 'cancel')}
        {renderFilterButton('notifications', 'Notifications', 'notifications-active')}
      </ScrollView>

      {/* Logs List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.logsContainer}
        contentContainerStyle={styles.logsContent}
      >
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="description" size={64} color="#9D4EDD" />
            </View>
            <Text style={styles.emptyTitle}>
              {logs.length === 0 ? 'No Activity Yet' : 'No Matching Logs'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {logs.length === 0 
                ? 'Activity logs will appear here as you use the app'
                : `No ${filter} logs found. Try a different filter.`}
            </Text>
            {logs.length === 0 && (
              <View style={styles.emptyTipsContainer}>
                <Text style={styles.emptyTipsTitle}>What gets logged:</Text>
                <View style={styles.emptyTip}>
                  <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                  <Text style={styles.emptyTipText}>Medicines marked as taken</Text>
                </View>
                <View style={styles.emptyTip}>
                  <MaterialIcons name="cancel" size={16} color="#F44336" />
                  <Text style={styles.emptyTipText}>Missed or late doses</Text>
                </View>
                <View style={styles.emptyTip}>
                  <MaterialIcons name="notifications-active" size={16} color="#2196F3" />
                  <Text style={styles.emptyTipText}>Notification arrivals and alarms</Text>
                </View>
                <View style={styles.emptyTip}>
                  <MaterialIcons name="settings" size={16} color="#757575" />
                  <Text style={styles.emptyTipText}>System operations</Text>
                </View>
              </View>
            )}
            {filter !== 'all' && logs.length > 0 && (
              <TouchableOpacity
                style={styles.resetFilterButton}
                onPress={() => setFilter('all')}
              >
                <MaterialIcons name="filter-list-off" size={20} color="#9D4EDD" />
                <Text style={styles.resetFilterText}>Show All Logs</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredLogs.map((log) => {
            const categoryInfo = logCategories[log.category] || logCategories.system;
            return (
              <View 
                key={log.id} 
                style={[
                  styles.logItem,
                  { borderLeftColor: categoryInfo.color }
                ]}
              >
                <View style={styles.logHeader}>
                  <View style={styles.logHeaderLeft}>
                    <MaterialIcons 
                      name={categoryInfo.icon} 
                      size={18} 
                      color={categoryInfo.color} 
                    />
                    <Text style={[
                      styles.logLevel, 
                      { color: categoryInfo.color }
                    ]}>
                      {categoryInfo.label.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.logHeaderRight}>
                    <Text style={styles.logDate}>{formatDate(log.timestamp)}</Text>
                    <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                  </View>
                </View>
                <Text style={styles.logMessage}>{log.message}</Text>
                {log.details && (
                  <Text style={styles.logDetails}>{log.details}</Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionButton, styles.clearButton]}
          onPress={clearLogs}
        >
          <MaterialIcons name="delete-outline" size={20} color="#F44336" />
          <Text style={[styles.actionButtonText, { color: '#F44336' }]}>
            Clear Logs
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.scrollButton,
            autoScroll && styles.scrollButtonActive
          ]}
          onPress={() => setAutoScroll(!autoScroll)}
        >
          <MaterialIcons 
            name={autoScroll ? "pause" : "play-arrow"} 
            size={20} 
            color={autoScroll ? "#fff" : "#9D4EDD"} 
          />
          <Text style={[
            styles.actionButtonText,
            { color: autoScroll ? "#fff" : "#9D4EDD" }
          ]}>
            {autoScroll ? 'Auto-scroll' : 'Paused'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  iconButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 56,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    marginRight: 8,
    minWidth: 80,
  },
  filterButtonActive: {
    borderWidth: 2,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    fontWeight: '700',
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    padding: 16,
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logHeaderRight: {
    alignItems: 'flex-end',
  },
  logLevel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logDate: {
    fontSize: 11,
    color: '#999',
  },
  logTime: {
    fontSize: 11,
    color: '#757575',
    fontWeight: '500',
    marginTop: 2,
  },
  logMessage: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  logDetails: {
    fontSize: 12,
    color: '#757575',
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3E5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyTipsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  emptyTipText: {
    fontSize: 13,
    color: '#757575',
    flex: 1,
  },
  resetFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F3E5F5',
    borderRadius: 24,
    marginTop: 16,
  },
  resetFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9D4EDD',
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  clearButton: {
    borderColor: '#F44336',
    backgroundColor: '#fff',
  },
  scrollButton: {
    borderColor: '#9D4EDD',
    backgroundColor: '#fff',
  },
  scrollButtonActive: {
    backgroundColor: '#9D4EDD',
    borderColor: '#9D4EDD',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default DevLogs;