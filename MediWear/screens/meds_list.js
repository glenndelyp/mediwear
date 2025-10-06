import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    SafeAreaView,
    ScrollView,
    Platform,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign } from "@expo/vector-icons";
import LoggingService from '../services/LoggingService';

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from '../services/firebaseConfig';

import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    deleteDoc 
} from 'firebase/firestore';

export default function MedicineList({ navigation }) {
    const [medicines, setMedicines] = useState([]);
    const [medicineStatus, setMedicineStatus] = useState({});
    const [currentDate, setCurrentDate] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);

    // Key to store the status with date
    const STATUS_STORAGE_KEY = 'medicine_status_';
    const DAILY_STATUS_KEY = 'daily_status_';

    const auth = getAuth();

    // Get current date in YYYY-MM-DD format
    const getCurrentDateKey = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    // Get formatted display date
    const getFormattedDate = () => {
        const today = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return today.toLocaleDateString('en-US', options);
    };

    const formatDateForDisplay = (isoDateString) => {
        if (!isoDateString) return "N/A";
        const date = new Date(isoDateString); 
        if (isNaN(date.getTime())) return "Invalid Date";
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return date.toLocaleDateString('en-US', options);
    };

    const cleanupOldAnalyticsData = async () => {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const today = new Date();
            const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const oneDayAgoKey = oneDayAgo.toISOString().split('T')[0];

            const dailyStatusKeysToRemove = allKeys.filter(key => {
                if (!key.startsWith(DAILY_STATUS_KEY)) return false;
                const dateFromKey = key.replace(DAILY_STATUS_KEY, '');
                return dateFromKey < oneDayAgoKey;
            });

            const statusKeysToRemove = allKeys.filter(key => {
                if (!key.startsWith(STATUS_STORAGE_KEY)) return false;
                const parts = key.split('_');
                const dateFromKey = parts[parts.length - 1];
                return dateFromKey < oneDayAgoKey;
            });

            const keysToRemove = [...dailyStatusKeysToRemove, ...statusKeysToRemove];

            if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
                console.log(`Cleaned up ${keysToRemove.length} old analytics entries`);
            }
        } catch (error) {
            console.error('Failed to cleanup old analytics data:', error);
        }
    };
    
    // Load medicine statuses from AsyncStorage
    const loadMedicineStatuses = async (meds, dateKey) => {
        const initialStatus = {};
        for (const med of meds) {
            const statusKey = `${STATUS_STORAGE_KEY}${med.id}_${dateKey}`;
            try {
                const status = await AsyncStorage.getItem(statusKey);
                initialStatus[med.id] = status || 'pending';
            } catch (error) {
                console.error(`Error loading status for medicine ${med.id}:`, error);
                initialStatus[med.id] = 'pending';
            }
        }
        setMedicineStatus(initialStatus);
    };

    // Load medicines from Firestore
    const loadMedicines = (userId) => {
        if (!userId) {
            setMedicines([]);
            setIsLoading(false);
            return () => {};
        }
        
        // Clean up old data
        cleanupOldAnalyticsData();
        
        // Setup Firestore query
        const medsQuery = query(
            collection(db, "medications"),
            where("userId", "==", userId)
        );

        // Setup real-time listener
        const unsubscribe = onSnapshot(medsQuery, async (snapshot) => {
            try {
                const dateKey = getCurrentDateKey();
                
                const fetchedMedicines = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                
                // ADD LOGGING HERE (only on initial load)
                if (fetchedMedicines.length > 0 && medicines.length === 0) {
                    await LoggingService.addLog(
                        'system',
                        `Loaded ${fetchedMedicines.length} medicines from Firestore`,
                        `User ID: ${userId}`
                    );
                }
                
                setMedicines(fetchedMedicines);
                await loadMedicineStatuses(fetchedMedicines, dateKey);
                setCurrentDate(getFormattedDate());
                setIsLoading(false);

            } catch (error) {
                console.error("Error processing Firestore data:", error);
                setIsLoading(false);
            }
        }, (error) => {
            console.error("Firestore subscription failed:", error);
            setIsLoading(false);
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
                setMedicines([]);
                setMedicineStatus({});
                setIsLoading(false);
            }
        });

        return () => authUnsubscribe();
    }, []); 

    // Get next reminder time
    const getNextReminderTime = (medicine) => {
        if (!medicine.reminderTimes || medicine.reminderTimes.length === 0) {
            return 'No reminders set';
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); 

        const reminderMinutes = medicine.reminderTimes.map(timeStr => {
            const [time, meridiem] = timeStr.split(' ');
            if (!time || !meridiem) return null;

            let [hours, minutes] = time.split(':').map(Number);

            if (meridiem.toUpperCase() === 'PM' && hours < 12) {
                hours += 12;
            } else if (meridiem.toUpperCase() === 'AM' && hours === 12) {
                hours = 0;
            }

            return hours * 60 + minutes;
        }).filter(time => time !== null);

        const nextReminder = reminderMinutes
            .filter(time => time > currentTime)
            .sort((a, b) => a - b)[0];

        if (nextReminder) {
            const hours = Math.floor(nextReminder / 60);
            const minutes = nextReminder % 60;
            const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
            const meridiem = hours >= 12 ? 'PM' : 'AM';
            return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
        }

        if (reminderMinutes.length > 0) {
            const firstReminder = Math.min(...reminderMinutes);
            const hours = Math.floor(firstReminder / 60);
            const minutes = firstReminder % 60;
            const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
            const meridiem = hours >= 12 ? 'PM' : 'AM';
            return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridiem} (Tomorrow)`;
        }

        return 'No valid reminders';
    };

    // Check if medicine should be taken today
    const isMedicineScheduledForToday = (medicine) => {
        const today = new Date();
        const dayOfWeek = today.getDay(); 

        if (!medicine.days) return true; 

        switch (medicine.days) {
            case 'Daily':
                return true;
            case 'Weekdays':
                return dayOfWeek >= 1 && dayOfWeek <= 5; 
            case 'Weekends':
                return dayOfWeek === 0 || dayOfWeek === 6; 
            case 'Mon-Wed-Fri':
                return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
            case 'Tue-Thu-Sat':
                return dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6;
            default:
                return true;
        }
    };

    useEffect(() => {
        const checkMissedDoses = async () => {
            const now = new Date();
            const dateKey = getCurrentDateKey();

            let hasChanges = false;
            const newStatus = { ...medicineStatus };

            for (const med of medicines) {
                if (!isMedicineScheduledForToday(med)) continue;

                if (newStatus[med.id] === 'pending' && med.reminderTimes && med.reminderTimes.length > 0) {
                    for (const reminderTime of med.reminderTimes) {
                        const [time, meridiem] = reminderTime.split(' ');
                        if (!time || !meridiem) continue;

                        let [hours, minutes] = time.split(':').map(Number);

                        if (meridiem.toLowerCase() === 'pm' && hours < 12) {
                            hours += 12;
                        }
                        if (meridiem.toLowerCase() === 'am' && hours === 12) {
                            hours = 0;
                        }

                        const doseTime = new Date();
                        doseTime.setHours(hours, minutes, 0, 0);

                        const tenMinutesAfterDose = new Date(doseTime.getTime() + 10 * 60000);

                        if (now > tenMinutesAfterDose && newStatus[med.id] === 'pending') {
                            newStatus[med.id] = 'missed';
                            hasChanges = true;

                            const statusKey = `${STATUS_STORAGE_KEY}${med.id}_${dateKey}`;
                            await AsyncStorage.setItem(statusKey, 'missed');

                            const currentTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const minutesLate = Math.floor((now - tenMinutesAfterDose) / 60000);
                            await LoggingService.addLog(
                                'missed',
                                `Missed dose detected: ${med.name}`,
                                `Scheduled: ${reminderTime}, Detected at: ${currentTimeStr} (${minutesLate} minutes late)`
                            );

                            await updateDailyProgress(med.id, 'missed', med.name);
                            break;
                        }
                    }
                }
            }

            if (hasChanges) {
                setMedicineStatus(newStatus);
            }
        };

        if (medicines.length > 0) {
            checkMissedDoses();
            const intervalId = setInterval(checkMissedDoses, 60000);
            return () => clearInterval(intervalId);
        }
    }, [medicines, medicineStatus]);

    const handleDelete = async (id) => {
        Alert.alert(
            "Delete Medicine",
            "Are you sure you want to delete this medicine? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    onPress: async () => {
                        try {
                            const medicine = medicines.find(m => m.id === id);
                            const medRef = doc(db, "medications", id);
                            await deleteDoc(medRef);

                            // ADD LOGGING HERE
                            await LoggingService.addLog(
                                'system',
                                `Medicine deleted: ${medicine?.name || 'Unknown'}`,
                                `Medicine ID: ${id}, Dosage: ${medicine?.dosage || 'N/A'}`
                            );

                            setMedicineStatus(prevStatus => {
                                const newStatus = { ...prevStatus };
                                delete newStatus[id];
                                return newStatus;
                            });

                            Alert.alert('Success', 'Medicine deleted successfully');
                        } catch (error) {
                            console.error('Failed to delete medicine:', error);
                            Alert.alert('Error', 'Failed to delete medicine. Please check your network connection.');
                        }
                    },
                    style: "destructive"
                },
            ]
        );
    };

    const handleView = (medicine) => {
        navigation.navigate("MedicineDetails", {
            medicine: medicine
        });
    };

    const handleTaken = async (medicineId) => {
        const dateKey = getCurrentDateKey();
        const statusKey = `${STATUS_STORAGE_KEY}${medicineId}_${dateKey}`;

        try {
            const currentStatus = medicineStatus[medicineId];
            if (currentStatus === 'taken') {
                Alert.alert('Info', 'This medicine is already marked as taken for today.');
                return;
            }

            await AsyncStorage.setItem(statusKey, 'taken');

            const medicine = medicines.find(med => med.id === medicineId);
            const medicineName = medicine ? medicine.name : 'Unknown';
            const medicineDosage = medicine ? medicine.dosage : 'N/A';

            // Log to LoggingService
            await LoggingService.addLog(
                'taken',
                `Medicine marked as taken: ${medicineName}`,
                `Dosage: ${medicineDosage}, Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}, Status: ${currentStatus === 'missed' ? 'late (was missed)' : 'on-time'}`
            );

            await updateDailyProgress(medicineId, 'taken', medicineName);

            setMedicineStatus(prevStatus => ({
                ...prevStatus,
                [medicineId]: 'taken',
            }));

            Alert.alert('Success', 'Medicine marked as taken!');
        } catch (error) {
            console.error('Failed to update medicine status:', error);
            Alert.alert('Error', 'Failed to update status.');
        }
    };

    const updateDailyProgress = async (medicineId, status, medicineName = 'Unknown') => {
        const dateKey = getCurrentDateKey();
        const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;

        try {
            const existingProgress = await AsyncStorage.getItem(progressKey);
            const progress = existingProgress ? JSON.parse(existingProgress) : {};

            progress[medicineId] = {
                status: status,
                timestamp: new Date().toISOString(),
                medicineName: medicineName
            };

            await AsyncStorage.setItem(progressKey, JSON.stringify(progress));
        } catch (error) {
            console.error('Failed to update daily progress:', error);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'taken':
                return <AntDesign name="checkcircle" size={30} color="#5cb85c" />;
            case 'missed':
                return <AntDesign name="closecircle" size={30} color="#d9534f" />;
            default:
                return <AntDesign name="medicinebox" size={30} color="#757575" />;
        }
    };

    // Get status text and color
    const getStatusText = (status) => {
        switch (status) {
            case 'taken':
                return { text: 'Taken', color: '#5cb85c' };
            case 'missed':
                return { text: 'Missed', color: '#d9534f' };
            default:
                return { text: 'Pending', color: '#757575' };
        }
    };

    // Filter medicines for today
    const todaysMedicines = medicines.filter(medicine => isMedicineScheduledForToday(medicine));

    // Render medicine item
    const renderItem = (item) => {
        const statusInfo = getStatusText(medicineStatus[item.id] || 'pending');
        const itemName = item.name || '';
        const itemDosage = item.dosage || '';

        return (
            <View key={item.id} style={styles.medicineCard}>
                <View style={styles.cardContent}>
                    <View style={styles.medicineIconContainer}>
                        {getStatusIcon(medicineStatus[item.id] || 'pending')}
                    </View>

                    <View style={styles.mainInfo}>
                        <Text style={styles.medicineName}>{itemName}</Text>
                        <Text style={styles.dosageFrequency}>Dose: {itemDosage}</Text>
                        <Text style={styles.nextDose}>
                            Next Dose: {getNextReminderTime(item)}
                        </Text>
                        {item.reminderDates && item.reminderDates[0] && (
                            <Text style={styles.startDate}>
                                Started: {formatDateForDisplay(item.reminderDates[0])}
                            </Text>
                        )}
                        {item.takeWithFood && (
                            <Text style={styles.foodReminder}>Take with food</Text>
                        )}
                        <View style={styles.statusContainer}>
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                Status: {statusInfo.text}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionButtonsContainer}>
                    {medicineStatus[item.id] !== 'taken' && (
                        <TouchableOpacity
                            style={[
                                styles.takenButton,
                                medicineStatus[item.id] === 'missed' && styles.takenButtonMissed
                            ]}
                            onPress={() => handleTaken(item.id)}
                        >
                            <Text style={styles.takenButtonText}>
                                {medicineStatus[item.id] === 'missed' ? 'Late Take' : 'Taken'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => navigation.navigate("MedicineDetails", { medicine: item })}
                    >
                        <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.deleteActionButton}
                        onPress={() => handleDelete(item.id)}
                    >
                        <Text style={styles.deleteActionButtonText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Meds</Text>
                    <Text style={styles.headerDate}>{getFormattedDate()}</Text>
                    <Text style={styles.headerSubtitle}>
                        Today's Medications ({todaysMedicines.length})
                    </Text>
                </View>

                {isLoading ? (
                    <View style={styles.loadingState}>
                        <Text style={styles.emptyTitle}>Loading Medications...</Text>
                        <Text style={styles.emptySubtitle}>Fetching data from the cloud.</Text>
                    </View>
                ) : !user ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Text style={styles.emptyIconText}>🔒</Text>
                        </View>
                        <Text style={styles.emptyTitle}>Please Log In</Text>
                        <Text style={styles.emptySubtitle}>Your medication list is private. Log in to access it.</Text>
                        <TouchableOpacity 
                            style={styles.loginButton} 
                            onPress={() => navigation.navigate("Login")}
                        >
                            <Text style={styles.loginButtonText}>Go to Login</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    todaysMedicines.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <Text style={styles.emptyIconText}>💊</Text>
                            </View>
                            <Text style={styles.emptyTitle}>
                                {medicines.length === 0 ? 'No medicines yet' : 'No medicines scheduled for today'}
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {medicines.length === 0
                                    ? 'Add your medicines to start tracking'
                                    : 'All your medicines are scheduled for other days'
                                }
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.listContainer}>
                            {todaysMedicines.map((item) => renderItem(item))}
                        </View>
                    )
                )}
            </ScrollView>
            
            {user && (
                <TouchableOpacity
                    style={styles.floatingActionButton}
                    onPress={() => navigation.navigate("AddMedicine")}
                >
                    <AntDesign name="plus" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 50,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    headerDate: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    headerSubtitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginTop: 10,
    },
    listContainer: {
        padding: 16,
    },
    medicineCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    medicineIconContainer: {
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainInfo: {
        flex: 1,
    },
    medicineName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    dosageFrequency: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    nextDose: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    startDate: {
        fontSize: 14,
        color: '#888',
        marginTop: 4,
        fontStyle: 'italic',
    },
    foodReminder: {
        fontSize: 12,
        color: '#ff9800',
        fontStyle: 'italic',
        marginBottom: 4,
    },
    statusContainer: {
        marginTop: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 6,
        flexWrap: 'wrap',
    },
    takenButton: {
        backgroundColor: '#28a745',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        flex: 1,
        minWidth: 70,
    },
    takenButtonMissed: {
        backgroundColor: '#ffc107',
    },
    takenButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    viewButton: {
        backgroundColor: '#007bff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        flex: 1,
        minWidth: 60,
    },
    viewButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    deleteActionButton: {
        backgroundColor: '#dc3545',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        flex: 1,
        minWidth: 70,
    },
    deleteActionButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        marginTop: 100,
    },
    emptyIcon: {
        marginBottom: 16,
    },
    emptyIconText: {
        fontSize: 64,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    floatingActionButton: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007bff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    loginButton: {
        marginTop: 20,
        backgroundColor: '#007bff',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        marginTop: 100,
    }
});
