import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { projectService } from '../src/services/projectService';

type JoinMethod = 'link' | 'code';

export default function JoinProjectScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<JoinMethod>('link');
  const [linkInput, setLinkInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Extract token from invite link
  const extractTokenFromLink = (link: string): string | null => {
    try {
      // Handle various link formats:
      // - Full URL: https://stratum.app/invite?token=abc123
      // - Relative: /invite?token=abc123
      // - Just token: abc123
      const trimmed = link.trim();
      
      // Try to parse as URL
      if (trimmed.includes('token=')) {
        const match = trimmed.match(/token=([^&\s]+)/);
        if (match) return match[1];
      }
      
      // If it looks like just a token (no slashes or special chars)
      if (!trimmed.includes('/') && !trimmed.includes('?') && trimmed.length > 10) {
        return trimmed;
      }
      
      return null;
    } catch {
      return null;
    }
  };

  const handleJoinByLink = async () => {
    if (!linkInput.trim()) {
      Alert.alert('Error', 'Please enter an invite link');
      return;
    }

    const token = extractTokenFromLink(linkInput);
    if (!token) {
      Alert.alert('Invalid Link', 'Could not find a valid invite token in the link. Please check and try again.');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const result = await projectService.acceptInvite(token);
      const projectId = result?.project_id;
      
      if (projectId) {
        // Navigate directly to the project
        router.replace(`/project/${projectId}`);
      } else {
        // Fallback if no project ID returned
        Alert.alert('Welcome!', 'You have successfully joined the project.', [
          { text: 'View Projects', onPress: () => router.replace('/(tabs)') }
        ]);
      }
    } catch (error: any) {
      let message = error?.detail || error?.message || 'Failed to join project';
      // Provide more helpful error messages
      if (message.includes('already a member')) {
        message = 'You are already a member of this project. Check your projects list.';
      } else if (message.includes('expired')) {
        message = 'This invite link has expired. Please ask the project leader for a new one.';
      } else if (message.includes('used')) {
        message = 'This invite link has already been used. Please ask for a new invite.';
      } else if (message.includes('not found')) {
        message = 'Invalid invite link. Please check the link and try again.';
      }
      Alert.alert('Cannot Join Project', message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!codeInput.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const result = await projectService.joinByCode(codeInput.trim().toUpperCase());
      const projectId = result?.project_id;
      
      if (projectId) {
        // Navigate directly to the project
        router.replace(`/project/${projectId}`);
      } else {
        // Fallback if no project ID returned
        Alert.alert('Welcome!', 'You have successfully joined the project.', [
          { text: 'View Projects', onPress: () => router.replace('/(tabs)') }
        ]);
      }
    } catch (error: any) {
      console.error('Join by code error:', error);
      let message = error?.detail || error?.message || 'Invalid or expired invite code';
      // Provide more helpful error messages
      if (error?.status === 401) {
        message = 'You need to be logged in to join a project. Please log in and try again.';
      } else if (error?.status === 403) {
        message = 'Access denied. You may need to log in again.';
      } else if (message.includes('already a member')) {
        message = 'You are already a member of this project. Check your projects list.';
      } else if (message.includes('expired')) {
        message = 'This invite code has expired. Please ask the project leader for a new one.';
      } else if (message.includes('used')) {
        message = 'This invite code has already been used. Please ask for a new invite.';
      } else if (message.includes('Invalid') || message.includes('not found')) {
        message = 'Invalid invite code. Please check the code and try again.';
      }
      Alert.alert('Cannot Join Project', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#F5F5F5" />
          </TouchableOpacity>
          <Text style={styles.title}>Join Project</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Method Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, method === 'link' && styles.tabActive]}
            onPress={() => setMethod('link')}
          >
            <Ionicons 
              name="link-outline" 
              size={20} 
              color={method === 'link' ? '#FF2A2A' : '#666'} 
            />
            <Text style={[styles.tabText, method === 'link' && styles.tabTextActive]}>
              By Link
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, method === 'code' && styles.tabActive]}
            onPress={() => setMethod('code')}
          >
            <Ionicons 
              name="keypad-outline" 
              size={20} 
              color={method === 'code' ? '#FF2A2A' : '#666'} 
            />
            <Text style={[styles.tabText, method === 'code' && styles.tabTextActive]}>
              By Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* Join by Link */}
        {method === 'link' && (
          <View style={styles.formSection}>
            <Text style={styles.label}>Invite Link</Text>
            <Text style={styles.hint}>
              Paste the invite link shared by the project leader
            </Text>
            <TextInput
              style={styles.input}
              placeholder="https://stratum.app/invite?token=..."
              placeholderTextColor="#555"
              value={linkInput}
              onChangeText={setLinkInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            <TouchableOpacity
              style={[styles.joinButton, loading && styles.joinButtonDisabled]}
              onPress={handleJoinByLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#F5F5F5" />
              ) : (
                <>
                  <Ionicons name="enter-outline" size={20} color="#F5F5F5" />
                  <Text style={styles.joinButtonText}>Join Project</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Join by Code */}
        {method === 'code' && (
          <View style={styles.formSection}>
            <Text style={styles.label}>Invite Code</Text>
            <Text style={styles.hint}>
              Enter the short code provided by the project leader
            </Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="ABC-123456"
              placeholderTextColor="#555"
              value={codeInput}
              onChangeText={(text) => setCodeInput(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={15}
            />
            <TouchableOpacity
              style={[styles.joinButton, loading && styles.joinButtonDisabled]}
              onPress={handleJoinByCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#F5F5F5" />
              ) : (
                <>
                  <Ionicons name="enter-outline" size={20} color="#F5F5F5" />
                  <Text style={styles.joinButtonText}>Join Project</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Ask the project leader for an invite link or code. Once you join, you'll be able to view and contribute to the project based on your assigned role.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#F5F5F5',
  },
  formSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  joinButton: {
    flexDirection: 'row',
    backgroundColor: '#FF2A2A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
});
