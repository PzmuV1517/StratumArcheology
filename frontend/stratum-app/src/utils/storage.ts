/**
 * @file
 * Cross-platform storage utility.
 *
 * Provides a unified key-value storage API using AsyncStorage
 * or localStorage depending on the platform.
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
// Cross-platform storage abstraction
import AsyncStorage from "@react-native-async-storage/async-storage";

// This works on both web and native thanks to @react-native-async-storage/async-storage
// which uses localStorage on web and native storage on mobile

export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error("Storage getItem error:", error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error("Storage setItem error:", error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error("Storage removeItem error:", error);
    }
  },

  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    try {
      const result = await AsyncStorage.multiGet(keys);
      return result as [string, string | null][];
    } catch (error) {
      console.error("Storage multiGet error:", error);
      return keys.map((key) => [key, null]);
    }
  },

  multiSet: async (keyValuePairs: [string, string][]): Promise<void> => {
    try {
      await AsyncStorage.multiSet(keyValuePairs);
    } catch (error) {
      console.error("Storage multiSet error:", error);
    }
  },

  multiRemove: async (keys: string[]): Promise<void> => {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error("Storage multiRemove error:", error);
    }
  },

  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error("Storage clear error:", error);
    }
  },

  getAllKeys: async (): Promise<string[]> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys as string[];
    } catch (error) {
      console.error("Storage getAllKeys error:", error);
      return [];
    }
  },
};

export default storage;
