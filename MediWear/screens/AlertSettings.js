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
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import NotificationService from '../services/NotificationService';
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

  // ADD THIS FUNCTION
  const showSuccessAlert = (isEditing) => {
    Alert.alert(
      'Success',
      isEditing ? 'Medication updated successfully!' : 'Medication added successfully!',
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home')
        }
      ]
    );
  };

  const handleCompleteSetup = async () => {
    if (!medicineData) {
      Alert.alert('Error', 'Medicine data is missing');
      return;
    }
    if (!user) { 
      Alert.alert('Authentication Error', 'You must be logged in to save medicine.');
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
      // SAVE FIRST, then try to schedule notifications
      await saveOnly(finalMedicineData);
      
      // Try to schedule notifications after successful save
      try {
        const hasPermission = await NotificationService.registerForPushNotificationsAsync();
        if (hasPermission && finalMedicineData.reminderEnabled) {
          const savedId = finalMedicineData.id || finalMedicineData.medicineId;
          if (savedId) {
            await NotificationService.scheduleNextMedicationNotification({
              ...finalMedicineData,
              id: savedId
            });
          }
        }
      } catch (notifError) {
        console.log('Could not schedule notifications:', notifError.message);
        // Don't show error to user since medicine was saved successfully
      }
      
    } catch (error) {
      console.error('Failed to save medicine:', error);
      Alert.alert('Error', `Failed to save medication: ${error.message}`);
    }
  };

  const saveAndSchedule = async (data) => {
    try {
      const finalId = await saveToFirestore(data);

      if (data.isEditing) {
        await NotificationService.cancelMedicineNotifications(data.id);
      }
      
      if (data.reminderEnabled && data.reminderTimes?.length > 0) {
        const scheduledData = {...data, id: finalId}; 
        await NotificationService.scheduleNextMedicationNotification(scheduledData);
        console.log(`Scheduled next notification for ${data.name}`);
      }
      
      showSuccessAlert(data.isEditing);
    } catch (error) {
      console.error('Failed to save with notifications:', error);
      Alert.alert('Error', 'Failed to save medication and schedule reminders. Please try again.');
    }
  };

  const saveOnly = async (data) => {
    try {
      await saveToFirestore(data); 
      showSuccessAlert(data.isEditing);
    } catch (error) {
      console.error('Failed to save without notifications:', error);
      Alert.alert('Error', 'Failed to save medication. Please try again.');
    }
  };

  const saveToFirestore = async (data) => {
    console.log('=== START saveToFirestore ===');
    console.log('Received data:', JSON.stringify(data, null, 2));
    
    try {
      if (!user) {
        throw new Error("User not logged in.");
      }

      console.log('User ID:', user.uid);

      const { isEditing, id, ...restData } = data;

      // Create the complete Firestore data object
      const firestoreData = {
        userId: user.uid,
        name: restData.name,
        dosage: restData.dosage,
        frequency: restData.frequency,
        days: restData.days,
        reminderTimes: restData.reminderTimes || [],
        reminderDates: restData.reminderDates || [],
        reminderEnabled: restData.reminderEnabled !== undefined ? restData.reminderEnabled : true,
        takeWithFood: restData.takeWithFood || false,
        specialInstructions: restData.specialInstructions || '',
        alertSettings: restData.alertSettings || {
          alertType: 'both',
          earlyReminder: false,
          waitOption: false,
        },
        updatedAt: serverTimestamp(),
      };

      console.log('Prepared Firestore data:', JSON.stringify(firestoreData, null, 2));
      console.log('Is Editing?', isEditing, 'ID:', id);

      if (isEditing && id) {
        console.log('Updating existing document:', id);
        const medicineRef = doc(db, "medications", id);
        await updateDoc(medicineRef, firestoreData);
        console.log("✅ Medication updated successfully:", id);
        return id;
      } else {
        console.log('Creating new document');
        const newMedRef = doc(collection(db, "medications"));
        console.log('New document ID:', newMedRef.id);
        
        const newDocData = {
          ...firestoreData,
          createdAt: serverTimestamp(),
          id: newMedRef.id,
        };
        
        console.log('About to save new document...');
        await setDoc(newMedRef, newDocData);
        console.log("✅ New medication added successfully:", newMedRef.id);
        return newMedRef.id;
      }
    } catch (error) {
      console.error('=== ERROR in saveToFirestore ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('Error stack:', error.stack);
      throw error;
    }
  };

  const handleBack = () => {
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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
    margin: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  medicineIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8D5F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  medicineIconText: {
    fontSize: 24,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  medicineDosage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  medicineFrequency: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timeIcon: {
    marginRight: 6,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    margin: 20,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  optionCardSelected: {
    borderColor: '#9D4EDD',
    backgroundColor: '#f8f4fd',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIcon: {
    fontSize: 18,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  recommendedBadge: {
    backgroundColor: '#9D4EDD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  recommendedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#9D4EDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleOptionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  toggleOptionCardActive: {
    borderColor: '#9D4EDD',
    backgroundColor: '#f8f4fd',
  },
  toggleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bottomSpacing: {
    height: 100,
  },
  bottomContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  backBottomButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBottomButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  completeButton: {
    flex: 2,
    backgroundColor: '#9D4EDD',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});