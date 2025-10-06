import { StyleSheet} from 'react-native';
import './services/firebaseConfig';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import 'react-native-gesture-handler'; 
import Login from './sign-login/login';
import SignUp from './sign-login/signup';
import Home from './screens/home';
import Device from './screens/device';
import AddMedicine from './screens/meds_sched';
import MedicineList from './screens/meds_list';
import AlertSettings from './screens/AlertSettings';
import MedicineDetails from './screens/meds_details';
import Stats from './screens/Stats';
import Profile from './screens/profile';
import HistoryLog from './screens/HistoryLog';
import DevLogs from './screens/Logs';
import LogScreen from './screens/LogScreen';
import {CustomDrawerContent} from './components/CustomDrawerContent';
import NotificationService from './services/NotificationService';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from "@expo/vector-icons";


const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

function MyTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, 
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'help-outline'; // fallback
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'MedList') {
            iconName = focused ? 'medical' : 'medical-outline';
          } else if (route.name === 'Device') {
            iconName = focused ? 'watch' : 'watch-outline';
          } else if (route.name === 'Stats') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#9D4EDD',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={Home}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="MedList" 
        component={MedicineList}
        options={{ tabBarLabel: 'Medications' }}
      />
      <Tab.Screen 
        name="Device" 
        component={Device}
        options={{ tabBarLabel: 'Device' }}
      />
      <Tab.Screen 
        name="Stats" 
        component={Stats}
        options={{ tabBarLabel: 'Stats' }}
      />
    </Tab.Navigator>
  );
}

function MyDrawer() {
  return (
    <Drawer.Navigator 
      drawerContent={(props) => <CustomDrawerContent {...props} />} 
      screenOptions={{headerShown: false}}
    >
      <Drawer.Screen name="HomeDrawer" component={MyTabs} />
      <Drawer.Screen name="LogScreen" component={LogScreen} />
      <Drawer.Screen name="DevLogs" component={DevLogs} />
      <Drawer.Screen name="History" component={HistoryLog} />
      <Drawer.Screen name="Profile" component={Profile} />
    </Drawer.Navigator>
  );
}

export default function App() {
  
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={styles.headerOptions  }
      >
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUp}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={MyDrawer}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="MedList"
          component={MedicineList}
          options={{
            headerShown: true,
            title: 'My Medications',
          }}
        />
        <Stack.Screen
          name="Device"
          component={Device}
          options={{
            headerShown: true, 
            title: 'Device Settings',
          }}
        />
        <Stack.Screen
          name="AddMedicine"
          component={AddMedicine}
          options={{
            headerShown: true,
            title: 'Add Medicine',
          }}
        />
        <Stack.Screen
          name="AlertSettings"
          component={AlertSettings}
          options={{
            headerShown: false,
            title: 'Alert Settings',
          }}
        />
        <Stack.Screen
          name="MedicineDetails"
          component={MedicineDetails}
          options={{
            headerShown: false, 
            title: 'Details',
          }}
        />
        <Stack.Screen
          name="Stats"
          component={Stats}
          options={{
            headerShown: true, 
            title: 'Status',
          }}
        />
        <Stack.Screen
          name="Profile"
          component={Profile}
          options={{
            headerShown: false, 
          }}
        />
        <Stack.Screen
          name="HistoryLog"
          component={HistoryLog}
          options={{
            headerShown: true, 
          }}
        />
         <Stack.Screen
          name="DevLogs"
          component={DevLogs}
          options={{
            headerShown: true, 
          }}
        />
          <Stack.Screen
          name="LogScreen"
          component={LogScreen}
          options={{
            headerShown: false, 
          }}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerOptions: {
    headerStyle: {
      backgroundColor: '#fff',
    },
    headerTintColor: 'black',
    headerTitleStyle: {
      fontWeight: 'bold',
      fontSize: 18,
    },
    headerTitleAlign: 'center',
  },
});