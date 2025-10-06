import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from 'react-native-vector-icons/Ionicons';

export default function Profile() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const user = JSON.parse(userData);
        setName(user.name || "");
        setAge(user.age || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setAddress(user.address || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const saveProfile = async () => {
    try {
      if (age && (isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120)) {
        Alert.alert("Error", "Please enter a valid age");
        return;
      }

      const userData = await AsyncStorage.getItem("userData");
      const existingData = userData ? JSON.parse(userData) : {};
      
      const profileData = {
        ...existingData,
        name,
        age,
        email,
        phone,
        address,
      };
      
      await AsyncStorage.setItem("userData", JSON.stringify(profileData));
      
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to save profile");
      console.error("Error saving profile:", error);
    }
  };

  const getInitials = (fullName) => {
    if (!fullName) return "?";
    const names = fullName.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Background */}
        <View style={styles.headerBackground} />

        {/* Profile Photo - Outside Container */}
        <View style={styles.profilePhotoSection}>
          <View style={styles.profilePhotoWrapper}>
            <View style={styles.profilePhotoContainer}>
              <View style={styles.profileInitialsContainer}>
                <Text style={styles.profileInitials}>
                  {getInitials(name)}
                </Text>
              </View>
            </View>
          </View>

          {/* User Name */}
          <Text style={styles.userName}>
            {name || "Your Name"}
          </Text>
          
          <Text style={styles.userEmail}>
            {email || "your.email@example.com"}
          </Text>
        </View>

        {/* Profile Information Container */}
        <View style={styles.infoContainer}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Personal Information
            </Text>
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
              style={[
                styles.editButton,
                isEditing && styles.editButtonActive
              ]}
            >
              <Text style={[
                styles.editButtonText,
                isEditing && styles.editButtonTextActive
              ]}>
                {isEditing ? "Cancel" : "Edit"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[
                styles.inputWrapper,
                isEditing && styles.inputWrapperEditing
              ]}>
                <Icon name="person-outline" size={18} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#A0AEC0"
                  editable={isEditing}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Age */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age</Text>
              <View style={[
                styles.inputWrapper,
                isEditing && styles.inputWrapperEditing
              ]}>
                <Icon name="calendar-outline" size={18} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  placeholder="Enter your age"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="numeric"
                  editable={isEditing}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[
                styles.inputWrapper,
                isEditing && styles.inputWrapperEditing
              ]}>
                <Icon name="mail-outline" size={18} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={isEditing}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[
                styles.inputWrapper,
                isEditing && styles.inputWrapperEditing
              ]}>
                <Icon name="call-outline" size={18} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="phone-pad"
                  editable={isEditing}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <View style={[
                styles.inputWrapper,
                styles.inputWrapperMultiline,
                isEditing && styles.inputWrapperEditing
              ]}>
                <Icon name="location-outline" size={18} color="#667eea" style={[styles.inputIcon, styles.inputIconTop]} />
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter your address"
                  placeholderTextColor="#A0AEC0"
                  multiline
                  numberOfLines={3}
                  editable={isEditing}
                  style={[styles.input, styles.inputMultiline]}
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          {isEditing && (
            <TouchableOpacity
              onPress={saveProfile}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>
                Save Changes
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA"
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  headerBackground: {
    height: 200,
    backgroundColor: "#667eea",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },
  profilePhotoSection: {
    alignItems: "center",
    marginTop: -80,
    marginBottom: 20
  },
  profilePhotoWrapper: {
    position: "relative"
  },
  profilePhotoContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 6,
    borderColor: "#FFFFFF",
    overflow: "hidden"
  },
  profileInitialsContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center"
  },
  profileInitials: {
    fontSize: 56,
    color: "#FFFFFF",
    fontWeight: "bold"
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2D3748",
    marginTop: 16,
    textAlign: "center"
  },
  userEmail: {
    fontSize: 16,
    color: "#718096",
    marginTop: 4,
    textAlign: "center"
  },
  infoContainer: {
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 20,
    marginBottom: 30
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2D3748"
  },
  editButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12
  },
  editButtonActive: {
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  editButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14
  },
  editButtonTextActive: {
    color: "#667eea"
  },
  formContainer: {
    gap: 20
  },
  inputGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A5568",
    marginBottom: 8
  },
  inputWrapper: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16
  },
  inputWrapperEditing: {
    backgroundColor: "#F7FAFC",
    borderWidth: 2,
    borderColor: "#667eea"
  },
  inputWrapperMultiline: {
    alignItems: "flex-start"
  },
  inputIcon: {
    marginRight: 12
  },
  inputIconTop: {
    marginTop: 14
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: "#2D3748"
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  saveButton: {
    backgroundColor: "#667eea",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 0.5
  }
});
