/**
 * @file
 * Project activity timeline service.
 *
 * Provides functions for fetching project timeline activities
 * and personal activity feeds from the backend API.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import api from "./api";
import {
  ProjectActivity,
  ActivityListResponse,
  ActivityType,
} from "./activityService.types";

/**
 * Activity service for project timeline
 * Works on both web and native platforms
 */
export const activityService = {
  /**
   * Get activities for a project with pagination
   */
  getActivities: async (
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ProjectActivity[]> => {
    try {
      const res = await api.get(`/activities/project/${projectId}`, {
        params: { limit, offset },
      });
      return res.data;
    } catch (error: any) {
      // Return empty list on error
      console.error("Failed to fetch activities:", error);
      return [];
    }
  },

  /**
   * Get recent activities (last N)
   */
  getRecentActivities: async (
    projectId: string,
    limit: number = 20,
  ): Promise<ProjectActivity[]> => {
    return activityService.getActivities(projectId, limit, 0);
  },

  /**
   * Get personal activities across all projects for the current user
   */
  getMyActivities: async (
    limit: number = 50,
    offset: number = 0,
  ): Promise<ProjectActivity[]> => {
    try {
      const res = await api.get("/activities/me", {
        params: { limit, offset },
      });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch my activities:", error);
      return [];
    }
  },

  /**
   * Get activity icon based on type
   */
  getActivityIcon: (activityType: ActivityType | string): string => {
    const iconMap: Record<string, string> = {
      // Project
      [ActivityType.PROJECT_CREATED]: "🎉",
      [ActivityType.PROJECT_UPDATED]: "✏️",
      [ActivityType.PROJECT_DELETED]: "🗑️",

      // Members
      [ActivityType.MEMBER_JOINED]: "👋",
      [ActivityType.MEMBER_LEFT]: "👤",
      [ActivityType.MEMBER_ROLE_CHANGED]: "🔄",
      [ActivityType.OWNERSHIP_TRANSFERRED]: "👑",

      // Files
      [ActivityType.FILE_UPLOADED]: "📄",
      [ActivityType.FILE_UPDATED]: "📄",
      [ActivityType.FILE_DELETED]: "🗑️",
      [ActivityType.FILE_MOVED]: "📁",
      [ActivityType.FILE_RENAMED]: "✏️",
      [ActivityType.FOLDER_CREATED]: "📁",
      [ActivityType.FOLDER_DELETED]: "🗑️",

      // Notes
      [ActivityType.NOTE_CREATED]: "📝",
      [ActivityType.NOTE_UPDATED]: "✏️",
      [ActivityType.NOTE_DELETED]: "🗑️",
      [ActivityType.NOTE_ATTACHMENT_ADDED]: "📎",
      [ActivityType.NOTE_ATTACHMENT_DELETED]: "📎",

      // Forms
      [ActivityType.CONTEXT_FEATURE_CREATED]: "🏛️",
      [ActivityType.CONTEXT_FEATURE_ADDED]: "🏛️",
      [ActivityType.STRATIGRAPHIC_UNIT_CREATED]: "📊",
      [ActivityType.STRATIGRAPHIC_UNIT_ADDED]: "📊",
      [ActivityType.ARTEFACT_CREATED]: "🏺",
      [ActivityType.ARTEFACT_ADDED]: "🏺",

      // GPS
      [ActivityType.GPS_ENABLED]: "📍",
      [ActivityType.GPS_DISABLED]: "📍",
      [ActivityType.GPS_UPDATED]: "📍",

      // Harris Matrix
      [ActivityType.HARRIS_MATRIX_UPDATED]: "🔗",
    };

    return iconMap[activityType] || "📌";
  },

  /**
   * Get activity color based on type
   * Blue (#007AFF) - Info/Navigation actions (GPS, files moved)
   * Green (#34C759) - Creation/positive actions (created, joined, uploaded)
   * Yellow (#FFD60A) - Update/modification actions (updated, role changed)
   * Red (#FF453A) - Deletion/negative actions (deleted, left)
   */
  getActivityColor: (activityType: ActivityType | string): string => {
    const colorMap: Record<string, string> = {
      // Project - Green for created, Yellow for updated, Red for deleted
      [ActivityType.PROJECT_CREATED]: "#34C759",
      [ActivityType.PROJECT_UPDATED]: "#FFD60A",
      [ActivityType.PROJECT_DELETED]: "#FF453A",

      // Members - Green for joined, Yellow for role change, Red for left
      [ActivityType.MEMBER_JOINED]: "#34C759",
      [ActivityType.MEMBER_LEFT]: "#FF453A",
      [ActivityType.MEMBER_ROLE_CHANGED]: "#FFD60A",
      [ActivityType.OWNERSHIP_TRANSFERRED]: "#FFD60A",

      // Files - Green for upload/create, Yellow for update/rename, Blue for move, Red for delete
      [ActivityType.FILE_UPLOADED]: "#34C759",
      [ActivityType.FILE_UPDATED]: "#FFD60A",
      [ActivityType.FILE_DELETED]: "#FF453A",
      [ActivityType.FILE_MOVED]: "#007AFF",
      [ActivityType.FILE_RENAMED]: "#FFD60A",
      [ActivityType.FOLDER_CREATED]: "#34C759",
      [ActivityType.FOLDER_DELETED]: "#FF453A",

      // Notes - Green for created, Yellow for updated, Red for deleted
      [ActivityType.NOTE_CREATED]: "#34C759",
      [ActivityType.NOTE_UPDATED]: "#FFD60A",
      [ActivityType.NOTE_DELETED]: "#FF453A",
      [ActivityType.NOTE_ATTACHMENT_ADDED]: "#34C759",
      [ActivityType.NOTE_ATTACHMENT_DELETED]: "#FF453A",

      // Forms - Green for all creation
      [ActivityType.CONTEXT_FEATURE_CREATED]: "#34C759",
      [ActivityType.CONTEXT_FEATURE_ADDED]: "#34C759",
      [ActivityType.STRATIGRAPHIC_UNIT_CREATED]: "#34C759",
      [ActivityType.STRATIGRAPHIC_UNIT_ADDED]: "#34C759",
      [ActivityType.ARTEFACT_CREATED]: "#34C759",
      [ActivityType.ARTEFACT_ADDED]: "#34C759",

      // GPS - Blue for info/location actions
      [ActivityType.GPS_ENABLED]: "#007AFF",
      [ActivityType.GPS_DISABLED]: "#8E8E93",
      [ActivityType.GPS_UPDATED]: "#007AFF",

      // Harris Matrix
      [ActivityType.HARRIS_MATRIX_UPDATED]: "#FFD60A",
    };

    return colorMap[activityType] || "#8E8E93";
  },

  /**
   * Get human-readable description for an activity
   */
  getActivityDescription: (
    activity: ProjectActivity,
    currentUserId?: string,
  ): string => {
    // Show "You" for the current user's actions
    const isCurrentUser = currentUserId && activity.user_id === currentUserId;
    const userName = isCurrentUser ? "You" : activity.user_name || "A team member";
    const extra = activity.extra_data || {};

    const descriptions: Record<string, string> = {
      // Project
      [ActivityType.PROJECT_CREATED]: `${userName} created the project`,
      [ActivityType.PROJECT_UPDATED]: `${userName} updated project settings`,
      [ActivityType.PROJECT_DELETED]: `${userName} deleted the project`,

      // Members
      [ActivityType.MEMBER_JOINED]: `${userName} joined the project`,
      [ActivityType.MEMBER_LEFT]: `${userName} left the project`,
      [ActivityType.MEMBER_ROLE_CHANGED]: isCurrentUser
        ? `Your role changed from ${extra.old_role || "unknown"} to ${extra.new_role || "unknown"}`
        : `${userName}'s role changed from ${extra.old_role || "unknown"} to ${extra.new_role || "unknown"}`,
      [ActivityType.OWNERSHIP_TRANSFERRED]: `${userName} transferred ownership`,

      // Files
      [ActivityType.FILE_UPLOADED]: `${userName} uploaded ${extra.file_name || "a file"}`,
      [ActivityType.FILE_UPDATED]: `${userName} updated ${extra.file_name || "a file"}`,
      [ActivityType.FILE_DELETED]: `${userName} deleted ${extra.file_name || "a file"}`,
      [ActivityType.FILE_MOVED]: `${userName} moved ${extra.file_name || "a file"}`,
      [ActivityType.FILE_RENAMED]: `${userName} renamed ${extra.old_name || "a file"} to ${extra.new_name || extra.file_name || "a new name"}`,
      [ActivityType.FOLDER_CREATED]: `${userName} created folder "${extra.folder_name || ""}"`,
      [ActivityType.FOLDER_DELETED]: `${userName} deleted folder "${extra.folder_name || ""}"`,

      // Notes
      [ActivityType.NOTE_CREATED]: `${userName} created note "${extra.note_title || "Untitled"}"`,
      [ActivityType.NOTE_UPDATED]: `${userName} updated note "${extra.note_title || "Untitled"}"`,
      [ActivityType.NOTE_DELETED]: `${userName} deleted a note`,
      [ActivityType.NOTE_ATTACHMENT_ADDED]: `${userName} added ${extra.attachment_type || "attachment"} to note`,
      [ActivityType.NOTE_ATTACHMENT_DELETED]: `${userName} removed attachment from note`,

      // Forms
      [ActivityType.CONTEXT_FEATURE_CREATED]: `${userName} recorded a context/feature`,
      [ActivityType.CONTEXT_FEATURE_ADDED]: `${userName} recorded a context/feature`,
      [ActivityType.STRATIGRAPHIC_UNIT_CREATED]: `${userName} recorded a stratigraphic unit`,
      [ActivityType.STRATIGRAPHIC_UNIT_ADDED]: `${userName} recorded a stratigraphic unit`,
      [ActivityType.ARTEFACT_CREATED]: `${userName} recorded an artefact`,
      [ActivityType.ARTEFACT_ADDED]: `${userName} recorded an artefact`,

      // GPS
      [ActivityType.GPS_ENABLED]: `${userName} enabled GPS tracking`,
      [ActivityType.GPS_DISABLED]: `${userName} disabled GPS tracking`,
      [ActivityType.GPS_UPDATED]: `${userName} updated GPS location`,

      // Harris Matrix
      [ActivityType.HARRIS_MATRIX_UPDATED]: `${userName} updated the Harris Matrix`,
    };

    return descriptions[activity.activity_type] || `${userName} performed an action`;
  },

  /**
   * Format activity timestamp
   */
  formatTimestamp: (timestamp: string): string => {
    // Parse the timestamp - backend may send UTC without timezone marker
    let date: Date;
    if (
      timestamp.endsWith("Z") ||
      timestamp.includes("+") ||
      timestamp.includes("-", 10)
    ) {
      // Already has timezone info
      date = new Date(timestamp);
    } else {
      // Assume UTC if no timezone
      date = new Date(timestamp + "Z");
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle negative differences (future dates or clock skew)
    if (diffMs < 0) return "Just now";

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  },
};

export { ActivityType };
export type {
  ProjectActivity,
  ActivityListResponse,
  ActivityExtraData,
} from "./activityService.types";
