import api from './api';
import {
  ProjectActivity,
  ActivityListResponse,
  ActivityType,
} from './activityService.types';

/**
 * Activity service for project timeline
 * Works on both web and native platforms
 */
export const activityService = {
  /**
   * Get activities for a project with pagination
   */
  getActivities: async (
    projectId: number,
    page: number = 1,
    perPage: number = 50
  ): Promise<ActivityListResponse> => {
    try {
      const res = await api.get(`/projects/${projectId}/activities`, {
        params: { page, per_page: perPage },
      });
      return res.data;
    } catch (error: any) {
      // Return empty list on error
      console.error('Failed to fetch activities:', error);
      return {
        activities: [],
        total: 0,
        page,
        per_page: perPage,
        has_more: false,
      };
    }
  },

  /**
   * Get recent activities (last N)
   */
  getRecentActivities: async (
    projectId: number,
    limit: number = 20
  ): Promise<ProjectActivity[]> => {
    const response = await activityService.getActivities(projectId, 1, limit);
    return response.activities;
  },

  /**
   * Get activity icon based on type
   */
  getActivityIcon: (activityType: ActivityType | string): string => {
    const iconMap: Record<string, string> = {
      // Project
      [ActivityType.PROJECT_CREATED]: '🎉',
      [ActivityType.PROJECT_UPDATED]: '✏️',
      [ActivityType.PROJECT_DELETED]: '🗑️',

      // Members
      [ActivityType.MEMBER_JOINED]: '👋',
      [ActivityType.MEMBER_LEFT]: '👤',
      [ActivityType.MEMBER_ROLE_CHANGED]: '🔄',
      [ActivityType.OWNERSHIP_TRANSFERRED]: '👑',

      // Files
      [ActivityType.FILE_UPLOADED]: '📄',
      [ActivityType.FILE_DELETED]: '🗑️',
      [ActivityType.FILE_MOVED]: '📁',
      [ActivityType.FOLDER_CREATED]: '📁',
      [ActivityType.FOLDER_DELETED]: '🗑️',

      // Notes
      [ActivityType.NOTE_CREATED]: '📝',
      [ActivityType.NOTE_UPDATED]: '✏️',
      [ActivityType.NOTE_DELETED]: '🗑️',
      [ActivityType.NOTE_ATTACHMENT_ADDED]: '📎',

      // Forms
      [ActivityType.CONTEXT_FEATURE_CREATED]: '🏛️',
      [ActivityType.STRATIGRAPHIC_UNIT_CREATED]: '📊',
      [ActivityType.ARTEFACT_CREATED]: '🏺',

      // GPS
      [ActivityType.GPS_ENABLED]: '📍',
      [ActivityType.GPS_DISABLED]: '📍',
      [ActivityType.GPS_UPDATED]: '📍',
    };

    return iconMap[activityType] || '📌';
  },

  /**
   * Get human-readable description for an activity
   */
  getActivityDescription: (activity: ProjectActivity): string => {
    const userName = activity.user_display_name || activity.user_email || 'Someone';
    const extra = activity.extra_data || {};

    const descriptions: Record<string, string> = {
      // Project
      [ActivityType.PROJECT_CREATED]: `${userName} created the project`,
      [ActivityType.PROJECT_UPDATED]: `${userName} updated project settings`,
      [ActivityType.PROJECT_DELETED]: `${userName} deleted the project`,

      // Members
      [ActivityType.MEMBER_JOINED]: `${userName} joined the project`,
      [ActivityType.MEMBER_LEFT]: `${userName} left the project`,
      [ActivityType.MEMBER_ROLE_CHANGED]: `${userName}'s role changed from ${extra.old_role} to ${extra.new_role}`,
      [ActivityType.OWNERSHIP_TRANSFERRED]: `${userName} transferred ownership`,

      // Files
      [ActivityType.FILE_UPLOADED]: `${userName} uploaded ${extra.file_name || 'a file'}`,
      [ActivityType.FILE_DELETED]: `${userName} deleted ${extra.file_name || 'a file'}`,
      [ActivityType.FILE_MOVED]: `${userName} moved ${extra.file_name || 'a file'}`,
      [ActivityType.FOLDER_CREATED]: `${userName} created folder ${extra.folder_name || ''}`,
      [ActivityType.FOLDER_DELETED]: `${userName} deleted folder ${extra.folder_name || ''}`,

      // Notes
      [ActivityType.NOTE_CREATED]: `${userName} created note "${extra.note_title || 'Untitled'}"`,
      [ActivityType.NOTE_UPDATED]: `${userName} updated note "${extra.note_title || 'Untitled'}"`,
      [ActivityType.NOTE_DELETED]: `${userName} deleted a note`,
      [ActivityType.NOTE_ATTACHMENT_ADDED]: `${userName} added ${extra.attachment_type || 'attachment'} to note`,

      // Forms
      [ActivityType.CONTEXT_FEATURE_CREATED]: `${userName} recorded a context/feature`,
      [ActivityType.STRATIGRAPHIC_UNIT_CREATED]: `${userName} recorded a stratigraphic unit`,
      [ActivityType.ARTEFACT_CREATED]: `${userName} recorded an artefact`,

      // GPS
      [ActivityType.GPS_ENABLED]: `${userName} enabled GPS tracking`,
      [ActivityType.GPS_DISABLED]: `${userName} disabled GPS tracking`,
      [ActivityType.GPS_UPDATED]: `${userName} updated GPS location`,
    };

    return descriptions[activity.activity_type] || `${userName} performed an action`;
  },

  /**
   * Format activity timestamp
   */
  formatTimestamp: (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  },
};

export { ActivityType };
export type { ProjectActivity, ActivityListResponse, ActivityExtraData } from './activityService.types';
