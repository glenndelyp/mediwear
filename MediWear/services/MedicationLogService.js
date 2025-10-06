import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';

class MedicationLogService {
  constructor() {
    this.userId = null;
  }

  async initialize() {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        this.userId = user.uid;
      } else {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          this.userId = parsedUser.uid || 'user_123';
        } else {
          this.userId = 'user_123';
        }
      }
      
      console.log('MedicationLogService initialized with userId:', this.userId);
      return this.userId;
    } catch (error) {
      console.error('Error initializing MedicationLogService:', error);
      this.userId = 'user_123';
      return this.userId;
    }
  }

  getUserId() {
    return this.userId;
  }

  // Subscribe to watch logs (from device)
  subscribeToWatchLogs(callback) {
    if (!this.userId) {
      console.error('userId not initialized');
      return () => {};
    }

    return firestore()
      .collection('users')
      .doc(this.userId)
      .collection('watchLogs')
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        (snapshot) => {
          const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            source: 'watch',
            ...doc.data()
          }));
          callback(logs);
        },
        (error) => {
          console.error('Watch logs subscription error:', error);
          callback([]);
        }
      );
  }

  // Subscribe to app logs (manual logs from MedList)
  subscribeToAppLogs(callback) {
    if (!this.userId) {
      console.error('userId not initialized');
      return () => {};
    }

    return firestore()
      .collection('users')
      .doc(this.userId)
      .collection('appLogs')
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        (snapshot) => {
          const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            source: 'app',
            ...doc.data()
          }));
          callback(logs);
        },
        (error) => {
          console.error('App logs subscription error:', error);
          callback([]);
        }
      );
  }

  // Save watch logs from Bluetooth device
  async saveWatchLogs(logs) {
    try {
      if (!this.userId) {
        await this.initialize();
      }

      const batch = firestore().batch();
      const logsRef = firestore()
        .collection('users')
        .doc(this.userId)
        .collection('watchLogs');

      for (const log of logs) {
        const docId = `${log.timestamp}_${log.medication.replace(/\s/g, '_')}`;
        const docRef = logsRef.doc(docId);
        
        batch.set(docRef, {
          timestamp: log.timestamp,
          datetime: log.datetime,
          medication: log.medication,
          dosage: log.dosage,
          action: log.action,
          snooze_count: log.snooze_count || 0,
          source: 'watch',
          synced_at: firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();
      console.log('Saved', logs.length, 'watch logs to Firestore');
      return { success: true, count: logs.length };
    } catch (error) {
      console.error('Error saving watch logs:', error);
      throw error;
    }
  }

  // Log medication action from MedList (app)
  async logMedicationFromApp(medicationData) {
    try {
      if (!this.userId) {
        await this.initialize();
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const docId = `${timestamp}_${medicationData.medication.replace(/\s/g, '_')}`;
      
      await firestore()
        .collection('users')
        .doc(this.userId)
        .collection('appLogs')
        .doc(docId)
        .set({
          timestamp,
          datetime: new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          medication: medicationData.medication,
          dosage: medicationData.dosage,
          action: medicationData.action,
          status: medicationData.status,
          snooze_count: 0,
          source: 'app',
          notes: medicationData.notes || '',
          synced_at: firestore.FieldValue.serverTimestamp()
        });

      console.log('Logged medication from app:', medicationData.medication);
      return { success: true };
    } catch (error) {
      console.error('Error logging from app:', error);
      throw error;
    }
  }

  // Clear all logs
  async clearAllLogs(type = 'all') {
    try {
      if (!this.userId) {
        await this.initialize();
      }

      let deletedCount = 0;

      if (type === 'all' || type === 'watch') {
        const watchSnapshot = await firestore()
          .collection('users')
          .doc(this.userId)
          .collection('watchLogs')
          .get();

        const watchBatch = firestore().batch();
        watchSnapshot.docs.forEach(doc => {
          watchBatch.delete(doc.ref);
        });
        await watchBatch.commit();
        deletedCount += watchSnapshot.docs.length;
      }

      if (type === 'all' || type === 'app') {
        const appSnapshot = await firestore()
          .collection('users')
          .doc(this.userId)
          .collection('appLogs')
          .get();

        const appBatch = firestore().batch();
        appSnapshot.docs.forEach(doc => {
          appBatch.delete(doc.ref);
        });
        await appBatch.commit();
        deletedCount += appSnapshot.docs.length;
      }

      return { success: true, count: deletedCount };
    } catch (error) {
      console.error('Error clearing logs:', error);
      throw error;
    }
  }
}

export default new MedicationLogService();