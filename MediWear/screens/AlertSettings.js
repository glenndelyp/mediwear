import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign } from '@expo/vector-icons';
import NotificationService from '../services/NotificationService';
import BluetoothService from '../services/BluetoothService'; 
import { db, auth } from '../services/firebaseConfig'; 
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'; 

export default function AlertSettings({ navigation, route }) {
  const medicineData = route?.params?.medicineData;
  const user = auth.currentUser; 
  
  const [alertType, setAlertType] = useState('both'); 
  const [earlyReminder, setEarlyReminder] = useState(false);
  const [waitOption, setWaitOption] = useState(false);

  const progressSteps = ['Medicine Details', 'Alert Settings', 'Complete'];
  const currentStep = 1; 

  const alertTypeOptions = [
    {
      id: 'phone',
      icon: '📱',
      title: 'Phone Only',
      subtitle: 'Alerts on your phone',
    },
    {
      id: 'watch',
      icon: '⌚',
      title: 'Watch Only',
      subtitle: 'Alerts on your smart watch',
    },
    {
      id: 'both',
      icon: '📱⌚',
      title: 'Both Devices',
      subtitle: 'Alerts on phone and watch',
      recommended: true,
    },
  ];

  const handleCompleteSetup = async () => {
    if (!medicineData) {
      Alert.alert('Error', 'Medicine data is missing');
      return;
    }
    
    if (!user) {
      Alert.alert('Authentication Error', 'You must be logged in');
      navigation.navigate('Login');
      return;
    }

    const finalMedicineData = {
      ...medicineData,
      alertSettings: {
        alertType,
        earlyReminder,
        waitOption,
      },
    };

    try {
      // Save to Firestore first and get the ID
      const finalId = await saveToFirestore(finalMedicineData);
      
      // Add the ID to the medication data
      const medicationWithId = { ...finalMedicineData, id: finalId };
      
      // Ask user if they want to sync to device
      Alert.alert(
        'Sync to MediWear?',
        'Would you like to sync this medication to your MediWear device now?',
        [
          {
            text: 'Skip',
            style: 'cancel',
            onPress: () => finishSetup(medicationWithId, false) // false = no sync attempted
          },
          {
            text: 'Sync Now',
            onPress: () => syncToDevice(medicationWithId)
          }
        ]
      );
      
    } catch (error) {
      console.error('Failed to save medicine:', error);
      Alert.alert('Error', 'Failed to save medication. Please try again.');
    }
  };

  const syncToDevice = async (medicationData) => {
    try {
      // Check if device is connected
      const connectionStatus = BluetoothService.getConnectionStatus();
      
      if (!connectionStatus.isConnected) {
        Alert.alert(
          'No Device Connected',
          'Please connect to your MediWear device first',
          [
            { text: 'OK', onPress: () => finishSetup(medicationData) }
          ]
        );
        return;
      }
      
      Alert.alert('Syncing...', 'Sending to MediWear device. Please check your watch.');
      
      const response = await BluetoothService.syncMedicationToDevice(medicationData);
      
      if (response.success) {
        Alert.alert(
          'Confirmed! ✓',
          response.message || 'Medication confirmed on device',
          [{ text: 'OK', onPress: () => finishSetup(medicationData) }]
        );
      } else {
        Alert.alert(
          'Declined',
          response.message || 'Medication was declined on device. It has been saved to your account but not added to device.',
          [{ text: 'OK', onPress: () => finishSetup(medicationData) }]
        );
      }
      
    } catch (error) {
      console.error('Sync error:', error);
      
      // Handle timeout specifically
      if (error.message === 'Device confirmation timeout') {
        Alert.alert(
          'Sync Timeout',
          'No response from device. Please check your MediWear device. Medication was saved to your account.',
          [{ text: 'OK', onPress: () => finishSetup(medicationData) }]
        );
      } else {
        Alert.alert(
          'Sync Failed',
          'Could not sync to device, but medication was saved to your account.',
          [{ text: 'OK', onPress: () => finishSetup(medicationData) }]
        );
      }
    }
  };

  const finishSetup = async (medicationData) => {
    try {
      if (medicationData.reminderEnabled && medicationData.reminderTimes?.length > 0) {
        await NotificationService.scheduleNextMedicationNotification(medicationData);
        console.log(`Scheduled notifications for ${medicationData.name}`);
      }
    } catch (error) {
      console.error('Failed to schedule notifications:', error);
    }
    
    showSuccessAlert(medicationData.isEditing);
  };

  const saveToFirestore = async (data) => {
    if (!user) {
      throw new Error("User not logged in.");
    }

    const { alertSettings, isEditing, id, ...medData } = data;

    const firestoreData = {
      userId: user.uid,
      ...medData,
      alertSettings,
      reminderEnabled: medData.reminderEnabled, 
      updatedAt: serverTimestamp(),
    };

    if (isEditing && id) {
      const medicineRef = doc(db, "medications", id);
      await updateDoc(medicineRef, firestoreData);
      console.log("Medication updated in Firestore:", id);
      return id;
    } else {
      const newMedRef = doc(collection(db, "medications"));
      await setDoc(newMedRef, {
        ...firestoreData,
        createdAt: serverTimestamp(),
        id: newMedRef.id 
      });
      console.log("New medication added to Firestore:", newMedRef.id);
      return newMedRef.id;
    }
  };

  const showSuccessAlert = (isEditing) => {
    Alert.alert(
      'Success!', 
      `Medication ${isEditing ? 'updated' : 'added'} successfully!`,
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]
    );
  };

  const handleBack = () => {
    // Pass the medicine data back to AddMedicine screen
    navigation.navigate('AddMedicine', { 
      medicine: medicineData,
      fromAlertSettings: true 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <AntDesign name="arrowleft" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Medicine Card */}
        <View style={styles.medicineCard}>
          <View style={styles.medicineIcon}>
            <Text style={styles.medicineIconText}>💊</Text>
          </View>
          <Text style={styles.medicineName}>
            {medicineData?.name || 'Medicine Name'}
          </Text>
          <Text style={styles.medicineDosage}>
            Take: {medicineData?.dosage || 'dosage'}
          </Text>
          <Text style={styles.medicineFrequency}>
            {medicineData?.frequency || 'frequency'}
          </Text>
          {medicineData?.reminderTimes && medicineData.reminderTimes.length > 0 && (
            <View style={styles.timeContainer}>
              <Text style={styles.timeIcon}>🕘</Text>
              <Text style={styles.timeText}>
                {medicineData.reminderTimes.join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Alert Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How would you like to be reminded?</Text>
          {alertTypeOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                alertType === option.id && styles.optionCardSelected
              ]}
              onPress={() => setAlertType(option.id)}
            >
              <View style={styles.optionLeft}>
                <View style={styles.optionIconContainer}>
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                  {option.recommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>Recommended</Text>
                    </View>
                  )}
                </View>
              </View>
              {alertType === option.id && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Additional Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Option</Text>

          <TouchableOpacity
            style={[
              styles.toggleOptionCard,
              earlyReminder && styles.toggleOptionCardActive
            ]}
            onPress={() => setEarlyReminder(!earlyReminder)}
          >
            <View style={styles.optionLeft}>
              <View style={styles.toggleIconContainer}>
                <Text style={styles.optionIcon}>🔔</Text>
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Early Reminder</Text>
                <Text style={styles.optionSubtitle}>Get a gentle alert 5 minutes early</Text>
              </View>
            </View>
            <Switch
              value={earlyReminder}
              onValueChange={setEarlyReminder}
              thumbColor={earlyReminder ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleOptionCard,
              waitOption && styles.toggleOptionCardActive
            ]}
            onPress={() => setWaitOption(!waitOption)}
          >
            <View style={styles.optionLeft}>
              <View style={styles.toggleIconContainer}>
                <Text style={styles.optionIcon}>⏰</Text>
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Allow "Wait 10 Minutes"</Text>
                <Text style={styles.optionSubtitle}>Option to delay if you're busy</Text>
              </View>
            </View>
            <Switch
              value={waitOption}
              onValueChange={setWaitOption}
              thumbColor={waitOption ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.backBottomButton} 
          onPress={handleBack}
        >
          <Text style={styles.backBottomButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteSetup}>
          <Text style={styles.completeButtonText}>
            {medicineData?.isEditing ? 'Update Meds' : 'Add Meds'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  medicineCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicineIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  medicineIconText: {
    fontSize: 30,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  medicineDosage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  medicineFrequency: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  timeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  timeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  optionCardSelected: {
    borderColor: '#9D4EDD',
    backgroundColor: '#F9F5FF',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  recommendedBadge: {
    backgroundColor: '#9D4EDD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#9D4EDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleOptionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  toggleOptionCardActive: {
    borderColor: '#9D4EDD',
    backgroundColor: '#F9F5FF',
  },
  toggleIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bottomSpacing: {
    height: 20,
  },
  bottomContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  backBottomButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  backBottomButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  completeButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#9D4EDD',
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
