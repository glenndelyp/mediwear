import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert,
  Switch,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dropdown } from 'react-native-element-dropdown';
import { AntDesign } from '@expo/vector-icons';
import { db, auth } from '../services/firebaseConfig'; 
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function AddMedicine({ navigation, route }) {
  const editingMedicine = route?.params?.medicine;
  const fromAlertSettings = route?.params?.fromAlertSettings;
  const isEditing = editingMedicine !== undefined && !fromAlertSettings;
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const user = auth.currentUser;

  const getCurrentDate = () => {
    return new Date();
  };

  const getInitialTimesAndDates = (times, startDate) => {
    const currentDate = getCurrentDate();
    
    if (!times || times.length === 0) {
      return { 
        formattedTimes: [], 
        reminderDates: [],
        timeObjects: []
      };
    }
    
    const timeObjects = times.map(timeStr => {
      try {
        const [time, meridiem] = timeStr.split(' ');
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours, 10);
        
        if (meridiem === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (meridiem === 'AM' && hour24 === 12) {
          hour24 = 0;
        }
        
        const dateObj = new Date();
        dateObj.setHours(hour24, parseInt(minutes, 10), 0, 0);
        return dateObj;
      } catch (error) {
        console.warn('Error parsing time:', timeStr, error);
        const defaultTime = new Date();
        defaultTime.setHours(9, 0, 0, 0);
        return defaultTime;
      }
    });
    
    const reminderDates = times.map(() => startDate || currentDate);
    
    return { 
      timeObjects, 
      reminderDates,
      formattedTimes: times.map(time => {
        try {
          return time.split(' ')[0] || '9:00';
        } catch (error) {
          return '9:00';
        }
      })
    };
  };

  const { timeObjects, reminderDates } = getInitialTimesAndDates(
    editingMedicine?.reminderTimes, 
    editingMedicine?.startDate ? new Date(editingMedicine.startDate) : null
  );

  const [selectedMedicine, setSelectedMedicine] = useState(editingMedicine?.name || '');
  const [isMedicineFocus, setIsMedicineFocus] = useState(false);
  const [selectedDosage, setSelectedDosage] = useState(editingMedicine?.dosage || '');
  const [isDosageFocus, setIsDosageFocus] = useState(false);
  const [dosageOptions, setDosageOptions] = useState([]);
  const [frequency, setFrequency] = useState(editingMedicine?.frequency || 'Once daily');
  const [isFrequencyFocus, setIsFrequencyFocus] = useState(false);
  const [days, setDays] = useState(editingMedicine?.days || 'Daily');
  const [isDaysFocus, setIsDaysFocus] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(editingMedicine?.reminderEnabled ?? true);
  const [takeWithFood, setTakeWithFood] = useState(editingMedicine?.takeWithFood || false);
  const [specialInstructions, setSpecialInstructions] = useState(editingMedicine?.specialInstructions || '');
  
  // Updated state for DateTimePicker
  const [reminderTimes, setReminderTimes] = useState(() => {
    if (timeObjects.length > 0) {
      return timeObjects;
    }
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0);
    return [defaultTime];
  });
  
  const [reminderDatesList, setReminderDatesList] = useState(() => {
    if (reminderDates.length > 0) {
      return reminderDates;
    }
    return [getCurrentDate()];
  });

  const frequencyOptions = [
    { label: 'Once daily', value: 'Once daily' },
    { label: 'Twice daily', value: 'Twice daily' },
    { label: 'Three times daily', value: 'Three times daily' },
    { label: 'Four times daily', value: 'Four times daily' },
    { label: 'Every other day', value: 'Every other day' },
    { label: 'Weekly', value: 'Weekly' },
    { label: 'As needed', value: 'As needed' },
  ];

  const daysOptions = [
    { label: 'Daily', value: 'Daily' },
    { label: 'Weekends', value: 'Weekends' },
    { label: 'Weekdays', value: 'Weekdays' },
    { label: 'Mon-Wed-Fri', value: 'Mon-Wed-Fri' },
    { label: 'Tue-Thu-Sat', value: 'Tue-Thu-Sat' },
  ];

  const medicineList = [
    { name: 'Biotin', dosages: ['10mcg', '500mcg'] },
    { name: 'Melatonin', dosages: ['1mg', '10mg'] },
    { name: 'Vitamin D3 (Forti-D)', dosages: ['400 IU', '2000 IU'] },
    { name: 'Aspirin (Low Dose)', dosages: ['81mg', '325mg'] },
    { name: 'Isotretinoin', dosages: ['10mg', '20mg'] },
    { name: 'Cetirizine (Allerta)', dosages: ['5mg', '10mg'] },
    { name: 'Folic Acid (Folart)', dosages: ['400mcg', '5mg'] },
    { name: 'Loratadine (Claritin)', dosages: ['10mg'] },
    { name: 'Glimepiride', dosages: ['1mg', '4mg'] },
    { name: 'Metoprolol (Betaloc)', dosages: ['25mg', '100mg'] },
    { name: 'Loperamide (Imodium)', dosages: ['2mg', '4mg'] },
    { name: 'Neurobion Mini', dosages: ['500mg'] },
    { name: 'Simvastatin (Zocor)', dosages: ['10mg', '40mg'] },
    { name: 'Amlodipine (Norvasc)', dosages: ['2.5mg', '10mg'] },
    { name: 'Clopidogrel', dosages: ['75mg', '300mg'] },
    { name: 'Salbutamol', dosages: ['2mg', '4mg'] },
    { name: 'Ranitidine (Zantac)', dosages: ['150mg', '300mg'] },
    { name: 'Folicare (Iron + Folic Acid)', dosages: ['60mg Iron + 400mcg FA'] },
    { name: 'Zinc Sulfate', dosages: ['10mg', '50mg'] }
  ];

  const medicineOptions = medicineList.map(medicine => ({
    label: medicine.name,
    value: medicine.name
  }));

  const getDosageOptions = (medicineName) => {
    const medicine = medicineList.find(med => med.name === medicineName);
    if (!medicine) return [];
    return medicine.dosages.map(dosage => ({
      label: dosage,
      value: dosage
    }));
  };

  useEffect(() => {
    if (selectedMedicine) {
      const options = getDosageOptions(selectedMedicine);
      setDosageOptions(options);
      if (!isEditing) {
        setSelectedDosage('');
      }
    } else {
      setDosageOptions([]);
      setSelectedDosage('');
    }
  }, [selectedMedicine, isEditing]);

  const handleMedicineChange = (item) => {
    setSelectedMedicine(item.value);
    setIsMedicineFocus(false);
  };

  const handleDosageChange = (item) => {
    setSelectedDosage(item.value);
    setIsDosageFocus(false);
  };

  const createTimeFromHourMinute = (hour, minute) => {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    return time;
  };

  // Enhanced validation function with proper error handling
  const validateDateTime = (date, time) => {
    try {
      if (!date || !time) return false;
      
      // Ensure both are valid Date objects
      const validDate = date instanceof Date ? date : new Date(date);
      const validTime = time instanceof Date ? time : new Date(time);
      
      if (isNaN(validDate.getTime()) || isNaN(validTime.getTime())) {
        return false;
      }
      
      const combinedDateTime = new Date(validDate);
      combinedDateTime.setHours(
        validTime.getHours(), 
        validTime.getMinutes(), 
        validTime.getSeconds(), 
        validTime.getMilliseconds()
      );
      
      const now = new Date();
      return combinedDateTime > now;
    } catch (error) {
      console.warn('Error validating datetime:', error);
      return false;
    }
  };

  const handleFrequencyChange = (item) => {
    const selectedFrequency = item.value;
    setFrequency(selectedFrequency);
    setIsFrequencyFocus(false);

    const currentDate = getCurrentDate();
    
    switch (selectedFrequency) {
      case 'Once daily':
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
        break;
      case 'Twice daily':
        setReminderTimes([
          createTimeFromHourMinute(9, 0),
          createTimeFromHourMinute(21, 0)
        ]);
        setReminderDatesList([currentDate, currentDate]);
        break;
      case 'Three times daily':
        setReminderTimes([
          createTimeFromHourMinute(8, 0),
          createTimeFromHourMinute(14, 0),
          createTimeFromHourMinute(20, 0)
        ]);
        setReminderDatesList([currentDate, currentDate, currentDate]);
        break;
      case 'Four times daily':
        setReminderTimes([
          createTimeFromHourMinute(8, 0),
          createTimeFromHourMinute(12, 0),
          createTimeFromHourMinute(16, 0),
          createTimeFromHourMinute(20, 0)
        ]);
        setReminderDatesList([currentDate, currentDate, currentDate, currentDate]);
        break;
      case 'Every other day':
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
        break;
      case 'Weekly':
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
        break;
      case 'As needed':
        setReminderTimes([]);
        setReminderDatesList([]);
        break;
      default:
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
    }
  };

  const handleDaysChange = (item) => {
    setDays(item.value);
    setIsDaysFocus(false);
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime && event.type === 'set') {
      const currentDate = reminderDatesList[currentTimeIndex];
      
      if (!validateDateTime(currentDate, selectedTime)) {
        Alert.alert('Error', 'Please select a future date and time');
        return;
      }
      
      const newTimes = [...reminderTimes];
      newTimes[currentTimeIndex] = selectedTime;
      setReminderTimes(newTimes);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate && event.type === 'set') {
      const currentTime = reminderTimes[currentDateIndex];
      
      if (!validateDateTime(selectedDate, currentTime)) {
        Alert.alert('Error', 'Please select a future date and time');
        return;
      }
      
      const newDates = [...reminderDatesList];
      newDates[currentDateIndex] = selectedDate;
      setReminderDatesList(newDates);
    }
  };

  const showTimePickerForIndex = (index) => {
    setCurrentTimeIndex(index);
    setShowTimePicker(true);
  };

  const showDatePickerForIndex = (index) => {
    setCurrentDateIndex(index);
    setShowDatePicker(true);
  };

  const formatTime12Hour = (date) => {
    try {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '12:00 PM';
      }
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('Error formatting time:', error);
      return '12:00 PM';
    }
  };

  const formatDate = (date) => {
    try {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Select Date';
      }
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return 'Select Date';
    }
  };

  const addReminderTime = () => {
    if (reminderTimes.length < 6) {
      const newTime = createTimeFromHourMinute(12, 0);
      const currentDate = getCurrentDate();
      
      const now = new Date();
      if (currentDate.toDateString() === now.toDateString()) {
        const futureTime = new Date(now.getTime() + 60 * 60 * 1000); // Add 1 hour
        newTime.setHours(futureTime.getHours(), futureTime.getMinutes(), 0, 0);
      }
      
      setReminderTimes([...reminderTimes, newTime]);
      setReminderDatesList([...reminderDatesList, currentDate]);
    }
  };

  const removeReminderTime = (index) => {
    if (reminderTimes.length > 1) {
      const newTimes = reminderTimes.filter((_, i) => i !== index);
      const newDates = reminderDatesList.filter((_, i) => i !== index);
      setReminderTimes(newTimes);
      setReminderDatesList(newDates);
    }
  };

  const handleSaveDraft = () => {
    if (!selectedMedicine.trim()) {
      Alert.alert('Oh no..', 'Please enter medication name');
      return;
    }
    Alert.alert('Success', 'Medication saved as draft');
  };

  // FIXED: This function now properly prepares data and navigates to AlertSettings
  const handleAddMedication = async () => {
    try {
      // Basic validation
      if (!selectedMedicine.trim() || !selectedDosage.trim()) {
        Alert.alert('Oh no..', 'Please fill in required fields');
        return;
      }

      if (!user) {
        Alert.alert('Error', 'You must be logged in to save medicine.');
        navigation.navigate('Login');
        return;
      }

      // Validate date/time only if reminders are set
      if (reminderTimes.length > 0 && reminderDatesList.length > 0) {
        for (let i = 0; i < reminderTimes.length; i++) {
          if (reminderDatesList[i] && reminderTimes[i]) {
            if (!validateDateTime(reminderDatesList[i], reminderTimes[i])) {
              Alert.alert('Oh No..', 'The time and Date must be in the correct format and in the future');
              return;
            }
          }
        }
      }

      // Format reminder times for storage and display
      const formattedReminderTimes = reminderTimes.map(time => formatTime12Hour(time));

      // Prepare medicine data to pass to AlertSettings
      const medicineData = {
        // Include ID if editing
        ...(isEditing && { id: editingMedicine.id }),
        
        // User info
        userId: user.uid,
        
        // Medicine details
        name: selectedMedicine,
        dosage: selectedDosage,
        frequency: frequency,
        days: days,
        reminderTimes: formattedReminderTimes,
        reminderDates: reminderDatesList.map(date => date.toISOString()),
        reminderEnabled: reminderEnabled,
        takeWithFood: takeWithFood,
        specialInstructions: specialInstructions,
        
        // Metadata
        isEditing: isEditing,
        updatedAt: serverTimestamp(),
      };

      // If we're editing directly (not from AlertSettings), save immediately
      if (isEditing && !fromAlertSettings) {
        const medicineRef = doc(db, "medications", editingMedicine.id);
        await updateDoc(medicineRef, medicineData);
        Alert.alert('Success', `${selectedMedicine} updated successfully!`, [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
        return;
      }

      // Navigate to AlertSettings with the medicine data
      navigation.navigate('AlertSettings', { medicineData });

    } catch (error) {
      console.error('Error preparing medication data:', error);
      Alert.alert('Error', 'Failed to prepare medication data. Please try again.');
    }
  };

  const handlebackButton = () => {
    navigation.navigate('Home');
  };

  // Helper function to get header title
  const getHeaderTitle = () => {
    if (isEditing) return 'Edit Medicine';
    if (fromAlertSettings) return 'Add Medicine';
    return 'Add Medicine';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handlebackButton}>
            <AntDesign name="arrowleft" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {getHeaderTitle()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHead}>Medication Details</Text>
          <View style={styles.dropdownContainer}>
            <Text style={styles.label}>Select Medicine:</Text>
            <Dropdown
              style={[styles.dropdown, isMedicineFocus && { borderColor: 'blue' }]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={medicineOptions}
              search
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={!isMedicineFocus ? 'Select Medicine' : '...'}
              searchPlaceholder="Search medicine..."
              value={selectedMedicine}
              onFocus={() => setIsMedicineFocus(true)}
              onBlur={() => setIsMedicineFocus(false)}
              onChange={handleMedicineChange}
            />
            <Text style={styles.label}>Select Dosage:</Text>
            <Dropdown
              style={[
                styles.dropdown,
                isDosageFocus && { borderColor: 'blue' },
                !selectedMedicine && { backgroundColor: '#f5f5f5', borderColor: '#ccc' }
              ]}
              placeholderStyle={[
                styles.placeholderStyle,
                !selectedMedicine && { color: '#ccc' }
              ]}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={dosageOptions}
              search={dosageOptions.length > 3}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={
                !selectedMedicine
                  ? 'Please select medicine first'
                  : (!isDosageFocus ? 'Select Dosage' : '...')
              }
              searchPlaceholder="Search dosage..."
              value={selectedDosage}
              onFocus={() => setIsDosageFocus(true)}
              onBlur={() => setIsDosageFocus(false)}
              onChange={handleDosageChange}
              disable={!selectedMedicine}
            />
            <Text style={styles.label}>Frequency:</Text>
            <Dropdown
              style={[styles.dropdown, isFrequencyFocus && { borderColor: 'blue' }]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={frequencyOptions}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={!isFrequencyFocus ? 'Select Frequency' : '...'}
              value={frequency}
              onFocus={() => setIsFrequencyFocus(true)}
              onBlur={() => setIsFrequencyFocus(false)}
              onChange={handleFrequencyChange}
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time & Date Schedule</Text>
          {frequency !== 'As needed' ? (
            <View style={styles.timeScheduleContainer}>
              {reminderTimes.map((time, index) => (
                <View key={index} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Reminder {index + 1}:</Text>
                  
                  {/* Time Picker Button */}
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => showTimePickerForIndex(index)}
                  >
                    <AntDesign name="clockcircleo" size={16} color="#666" />
                    <Text style={styles.dateTimeButtonText}>
                      {formatTime12Hour(time)}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Date Picker Button */}
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => showDatePickerForIndex(index)}
                  >
                    <AntDesign name="calendar" size={16} color="#666" />
                    <Text style={styles.dateTimeButtonText}>
                      {reminderDatesList[index] ? formatDate(reminderDatesList[index]) : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                  
                  {reminderTimes.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeTimeButton}
                      onPress={() => removeReminderTime(index)}
                    >
                      <Text style={styles.removeTimeText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {reminderTimes.length < 6 && (
                <TouchableOpacity style={styles.addTimeButton} onPress={addReminderTime}>
                  <Text style={styles.addTimeText}>Add Another Reminder</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.scheduleBox}>
              <Text style={styles.scheduleText}>
                No scheduled times - take as needed
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Days</Text>
          <View style={styles.dropdownContainer}>
            <Dropdown
              style={[styles.dropdown, isDaysFocus && { borderColor: 'blue' }]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={daysOptions}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={!isDaysFocus ? 'Select Days' : '...'}
              value={days}
              onFocus={() => setIsDaysFocus(true)}
              onBlur={() => setIsDaysFocus(false)}
              onChange={handleDaysChange}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Settings</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchTitle}>Reminder</Text>
              <Text style={styles.switchSubtitle}>
                Get notified when it's time
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              thumbColor={reminderEnabled ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchTitle}>Take with meal</Text>
              <Text style={styles.switchSubtitle}>
                Reminder to take with food
              </Text>
            </View>
            <Switch
              value={takeWithFood}
              onValueChange={setTakeWithFood}
              thumbColor={takeWithFood ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Add any special instructions or notes..."
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.draftButton} onPress={handleSaveDraft}>
            <Text style={styles.draftButtonText}>Save as Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddMedication}>
            <Text style={styles.addButtonText}> Next
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />

        {/* DateTimePicker Components */}
        {showTimePicker && (
          <DateTimePicker
            value={reminderTimes[currentTimeIndex] || new Date()}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}

        {showDatePicker && (
          <DateTimePicker
            value={reminderDatesList[currentDateIndex] || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionHead: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  dropdownContainer: {
    gap: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 5,
  },
  dropdown: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#999',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#333',
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 14,
    color: '#333',
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  timeScheduleContainer: {
    gap: 12,
  },
  timeRow: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dateTimeButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  removeTimeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addTimeButton: {
    backgroundColor: '#9D4EDD',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleBox: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  scheduleText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLeft: {
    flex: 1,
    marginRight: 15,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  switchSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    backgroundColor: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  draftButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  draftButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#9D4EDD',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacing: {
    height: 20,
  },
});