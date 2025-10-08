import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

export function CustomDrawerContent(props) {
  const navigation = useNavigation();
  const [userData, setUserData] = useState({
    name: 'User',
    email: 'user@example.com',
  });

  useEffect(() => {
    loadUserData();
    
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });

    return unsubscribe;
  }, [navigation]);

  const loadUserData = async () => {
    try {
      const storedData = await AsyncStorage.getItem('userData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setUserData({
          name: parsedData.name || 'User',
          email: parsedData.email || 'user@example.com',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    try {

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const menuItems = [
    { label: 'Home', screen: 'HomeDrawer', icon: 'home-outline' },
    { label: 'Watch Logs', screen: 'LogScreen', icon: 'medkit-outline' },
    { label: 'All Logs', screen: 'DevLogs', icon: 'stats-chart-outline' },
    { label: 'My History', screen: 'HistoryLog', icon: 'time-outline' },
    { label: 'My Profile', screen: 'Profile', icon: 'person-outline' },
    { label: 'My Inventory', screen: 'Inventory', icon: 'person-outline' },

  ];

  const getCurrentRouteIndex = () => {
    const currentRoute = props.state.routes[props.state.index];
    return menuItems.findIndex(item => item.screen === currentRoute.name);
  };

  const currentIndex = getCurrentRouteIndex();

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.7}
      >
        <View style={styles.profileIconContainer}>
          <Text style={styles.profileIconText}>{getInitials(userData.name)}</Text>
        </View>
        <Text style={styles.userName}>{userData.name}</Text>
        <Text style={styles.userEmail}>{userData.email}</Text>
      </TouchableOpacity>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={`drawer-item-${index}`}
            style={[
              styles.drawerItem,
              currentIndex === index && styles.activeDrawerItem,
            ]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <Icon
              name={item.icon}
              size={20}
              color={currentIndex === index ? '#9D4EDD' : '#757575'}
              style={styles.icon}
            />
            <Text
              style={[
                styles.drawerLabel,
                currentIndex === index && styles.activeDrawerLabel,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </DrawerContentScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Icon name="log-out-outline" size={20} color="#E53935" style={styles.icon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  profileIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#9D4EDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileIconText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 2,
  },
  drawerContent: {
    flexGrow: 1,
    paddingTop: 10,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  activeDrawerItem: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  icon: {
    marginRight: 15,
  },
  drawerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  activeDrawerLabel: {
    color: '#9D4EDD',
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 50,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  logoutText: {
    fontSize: 16,
    color: '#E53935',
    fontWeight: '500',
  },
});

export default CustomDrawerContent;
