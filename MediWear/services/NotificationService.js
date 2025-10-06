import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Vibration patterns
const ALARM_VIBRATION_PATTERNS = {
  light: [0, 100, 50, 100],
  medium: [0, 200, 100, 200],
  heavy: [0, 400, 200, 400, 200, 400],
};

class NotificationService {
  constructor() {
    this.notificationSubscription = null;
    this.responseSubscription = null;
  }

  // FIXED: Request permissions without push token
  async registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
      await this.setupNotificationChannels();
    }

    if (!Device.isDevice) {
      Alert.alert('Note', 'Notifications work best on physical devices');
      return true; // Allow testing on simulator
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      });
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Push notifications are needed to remind you to take your medications.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  }

  // Set up notification channels for Android
  async setupNotificationChannels() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication-reminders', {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: ALARM_VIBRATION_PATTERNS.medium,
        lightColor: '#9D4EDD',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
      });
    }
  }

  // Schedule next medication notification
  async scheduleNextMedicationNotification(medicine) {
    try {
      if (!medicine.reminderEnabled || !medicine.reminderTimes || medicine.reminderTimes.length === 0) {
        console.log(`No reminders enabled for ${medicine.name}`);
        return null;
      }

      const now = new Date();
      let nextNotificationDate = null;
      let nextReminderTime = null;

      // Find the next upcoming reminder time
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const checkDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
        
        if (this.shouldMedicineBeScheduledOnDay(medicine, checkDate)) {
          for (const reminderTime of medicine.reminderTimes) {
            const notificationDate = this.createNotificationDate(checkDate, reminderTime);
            
            if (notificationDate > now && (!nextNotificationDate || notificationDate < nextNotificationDate)) {
              nextNotificationDate = notificationDate;
              nextReminderTime = reminderTime;
            }
          }
        }
        
        if (nextNotificationDate && dayOffset === 0) {
          break;
        }
      }

      if (!nextNotificationDate) {
        console.log(`No upcoming notification times found for ${medicine.name}`);
        return null;
      }

      await this.cancelMedicineNotifications(medicine.id);

      const vibrationPattern = this.getVibrationPatternForMedicine(medicine);

      const notificationContent = {
        title: `💊 Time for ${medicine.name}`,
        body: `Take ${medicine.dosage}${medicine.takeWithFood ? ' with food' : ''}`,
        data: {
          medicineId: medicine.id,
          medicineName: medicine.name,
          dosage: medicine.dosage,
          takeWithFood: medicine.takeWithFood,
          scheduledTime: nextReminderTime,
          shouldReschedule: true,
        },
        sound: 'default',
        priority: Notifications.AndroidImportance.MAX,
        vibrate: vibrationPattern,
        badge: 1,
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          date: nextNotificationDate,
        },
      });

      // Schedule early reminder if enabled
      let earlyNotificationId = null;
      if (medicine.alertSettings?.earlyReminder) {
        earlyNotificationId = await this.scheduleEarlyReminder(medicine, nextReminderTime, nextNotificationDate);
      }

      const notificationIds = [notificationId];
      if (earlyNotificationId) {
        notificationIds.push(earlyNotificationId);
      }

      await AsyncStorage.setItem(
        `notifications_${medicine.id}`, 
        JSON.stringify(notificationIds)
      );

      console.log(`✅ Scheduled notification for ${medicine.name} at ${nextNotificationDate}`);
      return notificationIds;

    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  createNotificationDate(baseDate, reminderTime) {
    try {
      const [time, meridiem] = reminderTime.trim().split(' ');
      if (!time || !meridiem) {
        console.error('Invalid time format:', reminderTime);
        return null;
      }

      const [hoursStr, minutesStr] = time.split(':');
      if (!hoursStr || !minutesStr) {
        console.error('Invalid time components:', time);
        return null;
      }

      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        console.error('Invalid time values:', hours, minutes);
        return null;
      }
      
      let hour24 = hours;
      if (meridiem.toLowerCase() === 'pm' && hours < 12) {
        hour24 += 12;
      } else if (meridiem.toLowerCase() === 'am' && hours === 12) {
        hour24 = 0;
      }

      const notificationDate = new Date(baseDate);
      notificationDate.setHours(hour24, minutes, 0, 0);
      
      return notificationDate;
    } catch (error) {
      console.error('Error creating notification date:', error);
      return null;
    }
  }

  async scheduleEarlyReminder(medicine, reminderTime, originalNotificationDate) {
    try {
      const earlyDate = new Date(originalNotificationDate.getTime() - (5 * 60 * 1000));

      if (earlyDate <= new Date()) {
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ Upcoming: ${medicine.name}`,
          body: `You'll need to take ${medicine.dosage} in 5 minutes`,
          data: {
            medicineId: medicine.id,
            isEarlyReminder: true,
          },
          sound: 'default',
          vibrate: ALARM_VIBRATION_PATTERNS.light,
          badge: 1,
        },
        trigger: {
          date: earlyDate,
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling early reminder:', error);
      return null;
    }
  }

  setupNotificationListener() {
    if (this.responseSubscription) {
      this.responseSubscription.remove();
    }
    if (this.notificationSubscription) {
      this.notificationSubscription.remove();
    }

    this.responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { medicineId, isEarlyReminder, shouldReschedule } = response.notification.request.content.data;
      
      console.log('Notification tapped:', response.notification.request.content);
      
      if (!isEarlyReminder && shouldReschedule && medicineId) {
        await this.rescheduleAfterNotification(medicineId);
      }
    });

    this.notificationSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('Notification received:', notification);
      
      const { medicineId, isEarlyReminder, shouldReschedule } = notification.request.content.data;
      
      if (!isEarlyReminder && shouldReschedule && medicineId) {
        await this.rescheduleAfterNotification(medicineId);
      }
    });

    return () => {
      if (this.responseSubscription) {
        this.responseSubscription.remove();
      }
      if (this.notificationSubscription) {
        this.notificationSubscription.remove();
      }
    };
  }

  async rescheduleAfterNotification(medicineId) {
    try {
      const medicinesJson = await AsyncStorage.getItem('medicines');
      if (medicinesJson) {
        const medicines = JSON.parse(medicinesJson);
        const medicine = medicines.find(med => med.id === medicineId);
        
        if (medicine && medicine.reminderEnabled) {
          setTimeout(() => {
            this.scheduleNextMedicationNotification(medicine);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error rescheduling notification:', error);
    }
  }

  async scheduleAllMedicineNotifications() {
    try {
      const medicinesJson = await AsyncStorage.getItem('medicines');
      if (!medicinesJson) return;

      const medicines = JSON.parse(medicinesJson);
      
      for (const medicine of medicines) {
        if (medicine.reminderEnabled) {
          await this.scheduleNextMedicationNotification(medicine);
        }
      }
    } catch (error) {
      console.error('Error scheduling all notifications:', error);
    }
  }

  async cancelMedicineNotifications(medicineId) {
    try {
      const notificationIdsJson = await AsyncStorage.getItem(`notifications_${medicineId}`);
      
      if (notificationIdsJson) {
        const notificationIds = JSON.parse(notificationIdsJson);
        
        for (const notificationId of notificationIds) {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
        }
        
        await AsyncStorage.removeItem(`notifications_${medicineId}`);
        
        console.log(`Cancelled ${notificationIds.length} notifications for medicine ${medicineId}`);
      }
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      const allKeys = await AsyncStorage.getAllKeys();
      const notificationKeys = allKeys.filter(key => key.startsWith('notifications_'));
      
      if (notificationKeys.length > 0) {
        await AsyncStorage.multiRemove(notificationKeys);
      }
      
      console.log('Cancelled all scheduled notifications');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('Scheduled notifications:', notifications);
      return notifications;
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  shouldMedicineBeScheduledOnDay(medicine, date) {
    const dayOfWeek = date.getDay();
    
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
      case 'Every other day':
        const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
        return daysSinceEpoch % 2 === 0;
      case 'Weekly':
        return dayOfWeek === 0;
      default:
        return true;
    }
  }

  getVibrationPatternForMedicine(medicine) {
    if (medicine.isUrgent || medicine.isCritical) {
      return ALARM_VIBRATION_PATTERNS.heavy;
    } else if (medicine.isImportant) {
      return ALARM_VIBRATION_PATTERNS.medium;
    } else {
      return ALARM_VIBRATION_PATTERNS.light;
    }
  }

  async refreshAllNotifications() {
    console.log('Refreshing all medication notifications...');
    
    await this.cancelAllNotifications();
    await this.scheduleAllMedicineNotifications();
  }
}

export default new NotificationService();