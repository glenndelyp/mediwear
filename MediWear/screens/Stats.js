import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { AntDesign, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const Stats = ({ route, navigation }) => {
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [selectedTab, setSelectedTab] = useState('Weekly');
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalMedicines: 0,
    adherenceRate: 0,
    weeklyProgress: 0,
    streak: 0,
    thisWeekAdherence: [],
    topPerforming: [],
    missed: 0,
    taken: 0
  });

  const DAILY_STATUS_KEY = 'daily_status_';
  const auth = getAuth();

  // Get current date in YYYY-MM-DD format
  const getCurrentDateKey = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Load medicines from Firestore instead of AsyncStorage
  const loadMedicines = (userId) => {
    if (!userId) {
      setSelectedMedicines([]);
      resetStats();
      return () => {};
    }

    const medsQuery = query(
      collection(db, "medications"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(medsQuery, async (snapshot) => {
      try {
        const fetchedMedicines = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Filter only active medicines with reminders
        const activeMedicines = fetchedMedicines.filter(med => 
          med.reminderTimes && 
          med.reminderTimes.length > 0 && 
          med.reminderEnabled !== false
        );
        
        setSelectedMedicines(activeMedicines);
        await calculateRealStats(activeMedicines);
      } catch (error) {
        console.error('Failed to load medicines from Firestore:', error);
        resetStats();
      }
    }, (error) => {
      console.error("Firestore subscription failed:", error);
      resetStats();
    });

    return unsubscribe;
  };

  // Auth state listener
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, firebaseUser => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const firestoreUnsubscribe = loadMedicines(firebaseUser.uid);
        return () => {
          if (firestoreUnsubscribe) firestoreUnsubscribe();
        };
      } else {
        setSelectedMedicines([]);
        resetStats();
      }
    });

    return () => authUnsubscribe();
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && user.uid) {
        // Trigger a recalculation
        if (selectedMedicines.length > 0) {
          calculateRealStats(selectedMedicines);
        }
      }
    }, [user, selectedMedicines])
  );

  const resetStats = () => {
    setStats({
      totalMedicines: 0,
      adherenceRate: 0,
      weeklyProgress: 0,
      streak: 0,
      thisWeekAdherence: generateEmptyWeekData(),
      topPerforming: [],
      missed: 0,
      taken: 0
    });
  };

  const generateEmptyWeekData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      percentage: 0,
      taken: 0,
      total: 0
    }));
  };

  const calculateRealStats = async (medicineList) => {
    try {
      const totalMeds = medicineList.length;
      if (totalMeds === 0) {
        resetStats();
        return;
      }

      // Get today's stats
      const todayStats = await getTodayStats(medicineList);
      
      // Get weekly stats
      const weeklyStats = await getWeeklyStats(medicineList);
      
      // Calculate overall adherence rate
      const adherenceRate = weeklyStats.totalExpected > 0 ? 
        Math.round((weeklyStats.totalTaken / weeklyStats.totalExpected) * 100) : 0;
      
      // Calculate streak
      const streak = await calculateStreak();
      
      // Generate week adherence data
      const thisWeekAdherence = await generateRealWeekData(medicineList);
      
      // Top performing medications
      const topPerforming = await getTopPerformingMeds(medicineList);

      setStats({
        totalMedicines: totalMeds,
        adherenceRate,
        weeklyProgress: weeklyStats.weeklyPercentage,
        streak,
        thisWeekAdherence,
        topPerforming,
        missed: todayStats.missed,
        taken: todayStats.taken
      });
    } catch (error) {
      console.error('Failed to calculate real stats:', error);
      resetStats();
    }
  };

  const getTodayStats = async (medicineList) => {
    const dateKey = getCurrentDateKey();
    const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;
    
    try {
      const progressData = await AsyncStorage.getItem(progressKey);
      if (progressData) {
        const progress = JSON.parse(progressData);
        const statuses = Object.values(progress);
        
        return {
          taken: statuses.filter(item => item.status === 'taken').length,
          missed: statuses.filter(item => item.status === 'missed').length,
          total: statuses.length
        };
      }
    } catch (error) {
      console.error('Failed to get today stats:', error);
    }
    
    return { taken: 0, missed: 0, total: medicineList.length };
  };

  const getWeeklyStats = async (medicineList) => {
    const today = new Date();
    let totalExpected = 0;
    let totalTaken = 0;

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = checkDate.toISOString().split('T')[0];
      const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;
      
      try {
        const progressData = await AsyncStorage.getItem(progressKey);
        if (progressData) {
          const progress = JSON.parse(progressData);
          const statuses = Object.values(progress);
          
          totalExpected += statuses.length;
          totalTaken += statuses.filter(item => item.status === 'taken').length;
        }
      } catch (error) {
        console.error('Failed to get daily stats for', dateKey, error);
      }
    }

    const weeklyPercentage = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0;
    
    return { totalExpected, totalTaken, weeklyPercentage };
  };

  const calculateStreak = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const dailyStatusKeys = allKeys.filter(key => key.startsWith(DAILY_STATUS_KEY));
      
      if (dailyStatusKeys.length === 0) return 0;

      const sortedDates = dailyStatusKeys
        .map(key => key.replace(DAILY_STATUS_KEY, ''))
        .sort((a, b) => new Date(b) - new Date(a));

      let currentStreak = 0;
      const today = getCurrentDateKey();

      for (const date of sortedDates) {
        const progressKey = `${DAILY_STATUS_KEY}${date}`;
        const progressData = await AsyncStorage.getItem(progressKey);
        
        if (progressData) {
          const progress = JSON.parse(progressData);
          const statuses = Object.values(progress);
          const takenCount = statuses.filter(item => item.status === 'taken').length;
          const totalCount = statuses.length;
          
          const completionRate = totalCount > 0 ? (takenCount / totalCount) : 0;
          
          if (completionRate >= 0.8) {
            currentStreak++;
          } else {
            break;
          }
        } else if (date === today) {
          continue;
        } else {
          break;
        }
      }

      return currentStreak;
    } catch (error) {
      console.error('Failed to calculate streak:', error);
      return 0;
    }
  };

  const generateRealWeekData = async (medicineList) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const weekData = [];

    for (let i = 6; i >= 0; i--) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = checkDate.toISOString().split('T')[0];
      const dayIndex = (checkDate.getDay() + 6) % 7;
      const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;
      
      try {
        const progressData = await AsyncStorage.getItem(progressKey);
        let taken = 0;
        let total = 0;
        
        if (progressData) {
          const progress = JSON.parse(progressData);
          const statuses = Object.values(progress);
          taken = statuses.filter(item => item.status === 'taken').length;
          total = statuses.length;
        }
        
        const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;
        
        weekData.push({
          day: days[dayIndex],
          percentage,
          taken,
          total
        });
      } catch (error) {
        console.error('Failed to get day data for', dateKey, error);
        weekData.push({
          day: days[dayIndex],
          percentage: 0,
          taken: 0,
          total: 0
        });
      }
    }

    return weekData;
  };

  const getTopPerformingMeds = async (medicineList) => {
    const medPerformance = {};
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = checkDate.toISOString().split('T')[0];
      const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;
      
      try {
        const progressData = await AsyncStorage.getItem(progressKey);
        if (progressData) {
          const progress = JSON.parse(progressData);
          
          Object.entries(progress).forEach(([medId, data]) => {
            if (!medPerformance[medId]) {
              medPerformance[medId] = { taken: 0, total: 0, name: data.medicineName || 'Unknown' };
            }
            medPerformance[medId].total += 1;
            if (data.status === 'taken') {
              medPerformance[medId].taken += 1;
            }
          });
        }
      } catch (error) {
        console.error('Failed to get performance data for', dateKey, error);
      }
    }

    const topPerforming = Object.values(medPerformance)
      .map(med => ({
        name: med.name,
        percentage: med.total > 0 ? Math.round((med.taken / med.total) * 100) : 0,
        color: getRandomColor()
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);

    return topPerforming;
  };

  const getRandomColor = () => {
    const colors = ['#9D4EDD', '#4CAF50', '#FF9800', '#2196F3', '#F44336', '#00BCD4'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const getCurrentDate = () => {
    const today = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('en-US', options);
  };

  const renderTabButton = (tab) => (
    <TouchableOpacity
      key={tab}
      style={[
        styles.tabButton,
        selectedTab === tab && styles.activeTabButton
      ]}
      onPress={() => setSelectedTab(tab)}
    >
      <Text style={[
        styles.tabButtonText,
        selectedTab === tab && styles.activeTabButtonText
      ]}>
        {tab}
      </Text>
    </TouchableOpacity>
  );

  const renderWeeklyChart = () => (
    <View style={styles.chartContainer}>
      <View style={styles.chartGrid}>
        {stats.thisWeekAdherence.map((day, index) => (
          <View key={index} style={styles.chartColumn}>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.bar,
                  { 
                    height: Math.max(day.percentage * 0.8, 8),
                    backgroundColor: day.percentage > 70 ? '#4CAF50' : 
                                    day.percentage > 40 ? '#FF9800' : '#F44336'
                  }
                ]} 
              />
            </View>
            <Text style={styles.dayLabel}>{day.day}</Text>
            <Text style={styles.percentageLabel}>{day.percentage}%</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const getInsightText = () => {
    const { adherenceRate } = stats;
    
    if (adherenceRate >= 90) {
      return "Excellent adherence! You're consistently taking your medications on time.";
    } else if (adherenceRate >= 70) {
      return "Good progress! Consider setting additional reminders to improve consistency.";
    } else if (adherenceRate >= 50) {
      return "Your adherence needs improvement. Try setting up more frequent reminders.";
    } else {
      return "Low adherence detected. Consider speaking with your healthcare provider about your medication routine.";
    }
  };

  const getBestTimeText = () => {
    return "Most medications are taken consistently when scheduled for regular daily routines.";
  };

  const getSuggestionText = () => {
    const { adherenceRate } = stats;
    
    if (adherenceRate >= 90) {
      return "Keep up the excellent work! Your current routine is working well.";
    } else if (adherenceRate >= 70) {
      return "Try linking medication times to daily habits like meals or bedtime.";
    } else {
      return "Consider using pill organizers and multiple reminder methods to improve consistency.";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerDate}>{getCurrentDate()}</Text>
        </View>

        {!user ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Please Log In</Text>
            <Text style={styles.emptySubtitle}>Log in to view your medication statistics.</Text>
          </View>
        ) : (
          <>
            <View style={styles.overviewSection}>
              <View style={styles.overviewRow}>
                <View style={[styles.overviewCard, { backgroundColor: '#fff' }]}>
                  <Text style={styles.overviewNumber}>{stats.adherenceRate}%</Text>
                  <Text style={styles.overviewLabel}>Overall</Text>
                  <Text style={styles.overviewSubLabel}>Adherence</Text>
                </View>
                
                <View style={[styles.overviewCard, { backgroundColor: '#fff' }]}>
                  <Text style={styles.overviewNumber}>{stats.taken}</Text>
                  <Text style={styles.overviewLabel}>Taken</Text>
                  <Text style={styles.overviewSubLabel}>Today</Text>
                </View>
              </View>
              
              <View style={styles.overviewRow}>
                <View style={[styles.overviewCard, { backgroundColor: '#fff' }]}>
                  <Text style={styles.overviewNumber}>{stats.missed}</Text>
                  <Text style={styles.overviewLabel}>Missed</Text>
                  <Text style={styles.overviewSubLabel}>Today</Text>
                </View>
                
                <View style={[styles.overviewCard, { backgroundColor: '#fff' }]}>
                  <Text style={styles.overviewNumber}>{stats.streak}</Text>
                  <Text style={styles.overviewLabel}>Days</Text>
                  <Text style={styles.overviewSubLabel}>Streak</Text>
                </View>
              </View>
            </View>

            <View style={styles.tabsContainer}>
              {['Weekly', 'Trends', 'Insights'].map(renderTabButton)}
            </View>

            {selectedTab === 'Weekly' && (
              <View style={styles.chartSection}>
                <Text style={styles.sectionTitle}>This Week's Adherence</Text>
                {renderWeeklyChart()}
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.legendText}>Good (70%+)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                    <Text style={styles.legendText}>Fair (40-70%)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                    <Text style={styles.legendText}>Poor 40%)</Text>
                  </View>
                </View>
              </View>
            )}

            {selectedTab === 'Trends' && (
              <View style={styles.trendsSection}>
                <Text style={styles.sectionTitle}>Weekly Progress</Text>
                <View style={styles.trendCard}>
                  <View style={styles.trendItem}>
                    <Text style={styles.trendLabel}>This Week</Text>
                    <Text style={[styles.trendValue, { color: '#4CAF50' }]}>{stats.weeklyProgress}%</Text>
                  </View>
                  <View style={styles.trendItem}>
                    <Text style={styles.trendLabel}>Overall Rate</Text>
                    <Text style={[styles.trendValue, { color: '#9D4EDD' }]}>{stats.adherenceRate}%</Text>
                  </View>
                  <View style={styles.trendItem}>
                    <Text style={styles.trendLabel}>Current Streak</Text>
                    <Text style={[styles.trendValue, { color: '#FF9800' }]}>{stats.streak} days</Text>
                  </View>
                </View>

                {stats.topPerforming.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Top Performing</Text>
                    {stats.topPerforming.map((med, index) => (
                      <View key={index} style={styles.performanceCard}>
                        <View style={styles.performanceLeft}>
                          <View style={[styles.performanceDot, { backgroundColor: med.color }]} />
                          <Text style={styles.performanceName}>{med.name}</Text>
                        </View>
                        <Text style={styles.performancePercentage}>{med.percentage}%</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {selectedTab === 'Insights' && (
              <View style={styles.insightsSection}>
                <Text style={styles.sectionTitle}>Weekly Summary</Text>
                
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <MaterialIcons name="trending-up" size={24} color="#4CAF50" />
                    <Text style={styles.insightTitle}>Progress Update</Text>
                  </View>
                  <Text style={styles.insightText}>{getInsightText()}</Text>
                </View>

                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <MaterialIcons name="schedule" size={24} color="#FF9800" />
                    <Text style={styles.insightTitle}>Routine Analysis</Text>
                  </View>
                  <Text style={styles.insightText}>{getBestTimeText()}</Text>
                </View>

                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <MaterialIcons name="lightbulb-outline" size={24} color="#9D4EDD" />
                    <Text style={styles.insightTitle}>Suggestion</Text>
                  </View>
                  <Text style={styles.insightText}>{getSuggestionText()}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },

  header: {
    marginTop: 50,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 16,
    color: '#666',
  },

  overviewSection: {
    marginBottom: 24,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  overviewCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  overviewNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  overviewSubLabel: {
    fontSize: 12,
    color: '#333',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#9D4EDD',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Chart
  chartSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  chartContainer: {
    height: 120,
    marginBottom: 16,
  },
  chartGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
    paddingHorizontal: 8,
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 60,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    width: 16,
    borderRadius: 8,
    minHeight: 8,
  },
  dayLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  percentageLabel: {
    fontSize: 10,
    color: '#999',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },

  // Trends
  trendsSection: {
    marginBottom: 20,
  },
  trendCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  trendValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  performanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  performanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  performanceName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  performancePercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },

  // Insights
  insightsSection: {
    marginBottom: 20,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    elevation: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // Quick Actions
  quickActions: {
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
});

export default Stats;