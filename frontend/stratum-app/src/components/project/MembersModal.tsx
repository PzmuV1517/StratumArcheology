import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Platform, Image } from 'react-native';
import Constants from 'expo-constants';
import { projectService } from '../../services/projectService';

interface Member {
  id: string;
  display_name: string;
  email: string;
  role: 'LEADER' | 'RESEARCHER' | 'GUEST' | 'leader' | 'researcher' | 'guest';
}



interface Props {
  visible: boolean;
  members: Member[];
  onClose: () => void;
  onManage: () => void;
  renderMember: (member: Member) => React.ReactNode;
  projectId: string;
  currentUserId?: string;
  projectOwnerId?: string;
}

export default function MembersModal({ visible, members, onClose, onManage, renderMember, projectId, currentUserId, projectOwnerId }: Props) {
  const ownerId = projectOwnerId || members.find(m => (m.role || '').toString().toUpperCase() === 'LEADER')?.id || null;
  const isOwner = useMemo(() => currentUserId && ownerId === currentUserId, [currentUserId, ownerId]);
  const [inviteRole, setInviteRole] = useState<'RESEARCHER' | 'GUEST'>('GUEST');
  const appOrigin = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.origin : '') : '';

  const [manageError, setManageError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);

  const changeRole = async (userId: string, role: 'RESEARCHER' | 'GUEST') => {
    try {
      setManageError(null);
      const member = members.find(m => m.id === userId);
      const currentRole = (member?.role || '').toString().toUpperCase();
      const newRole = role.toUpperCase();
      if (currentRole === newRole) {
        setManageError(`User is already a ${role.toLowerCase()}`);
        return;
      }
      await projectService.updateMemberRole(projectId, userId, role.toLowerCase());
      setIsManaging(false);
      onManage();
    } catch (e: any) {
      setManageError(e?.message || 'Failed to update role');
    }
  };

  const removeMember = async (userId: string) => {
    try {
      setManageError(null);
      await projectService.removeMember(projectId, userId);
      onManage();
    } catch (e: any) {
      setManageError(e?.message || 'Failed to remove member');
    }
  };

  const generateInvite = async () => {
    try {
      setManageError(null);
      setIsGenerating(true);
      setGeneratedLink(null);
      const resp = await projectService.createInvite(projectId, inviteRole.toLowerCase());
      const link = `${appOrigin || 'stratum://app'}${resp.accept_path}`;
      setGeneratedLink(link);
      setGeneratedExpiresAt(resp.expires_at || null as any);
    } catch (e: any) {
      setManageError(e?.detail || e?.message || 'Failed to generate invite');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: '85%' }]}>
          <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Team Members</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => setIsManaging(!isManaging)}>
              <Text style={styles.actionButtonText}>{isManaging ? '✓ Done' : '+ Manage'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: '75%' }}>
            {members.length > 0 ? (
              members.map((m) => (
                <View key={m.id} style={{ marginBottom: 10 }}>
                  {renderMember(m)}
                  {isOwner && m.id !== ownerId && isManaging && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => changeRole(m.id, 'RESEARCHER')}>
                        <Text style={styles.smallBtnText}>Make Researcher</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => changeRole(m.id, 'GUEST')}>
                        <Text style={styles.smallBtnText}>Make Guest</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtnDanger} onPress={() => removeMember(m.id)}>
                        <Text style={styles.smallBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No team members</Text>
                <Text style={styles.emptyStateSubtext}>Invite colleagues to collaborate</Text>
              </View>
            )}
          </ScrollView>
          {isOwner && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: '#F5F5F5', marginBottom: 8, fontWeight: '600' }}>Invite to project</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity style={[styles.smallBtn, inviteRole === 'GUEST' && styles.smallBtnActive]} onPress={() => setInviteRole('GUEST')}>
                  <Text style={styles.smallBtnText}>Guest</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, inviteRole === 'RESEARCHER' && styles.smallBtnActive]} onPress={() => setInviteRole('RESEARCHER')}>
                  <Text style={styles.smallBtnText}>Researcher</Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity style={[styles.actionButton, { alignSelf: 'flex-start' }]} onPress={generateInvite} disabled={isGenerating}>
                  <Text style={styles.actionButtonText}>{isGenerating ? 'Generating…' : 'Generate Link'}</Text>
                </TouchableOpacity>
                {generatedLink && (
                  <>
                    <Text selectable style={{ color: '#9A9A9A', marginTop: 8 }}>{generatedLink}</Text>
                    {Platform.OS === 'web' && (
                      <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(generatedLink)}` }} style={{ width: 180, height: 180, marginTop: 8, borderRadius: 8 }} />
                    )}
                    {generatedExpiresAt && (
                      <Text style={{ color: '#6A6A6A', marginTop: 4 }}>Expires: {new Date(generatedExpiresAt).toLocaleString()}</Text>
                    )}
                  </>
                )}
              </View>
              <Text style={{ color: '#9A9A9A', marginTop: 6 }}>Share the invite link or QR. Recipient must be signed in to accept.</Text>
            </View>
          )}
          {manageError && <Text style={{ color: '#FF2A2A', marginTop: 8 }}>{manageError}</Text>}
          <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
            <TouchableOpacity style={[styles.actionButton]} onPress={onClose}>
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1E1E1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  actionButton: {
    backgroundColor: '#FF2A2A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#F5F5F5',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  smallBtn: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnActive: { backgroundColor: '#FF2A2A' },
  smallBtnDanger: { backgroundColor: '#8B0000', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: '#F5F5F5', fontSize: 12 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9A9A9A',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
});
