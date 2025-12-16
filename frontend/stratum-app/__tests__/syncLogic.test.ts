/**
 * Pure Unit Tests for Sync Logic
 * 
 * These tests verify the core sync queue and conflict logic without
 * requiring React Native or Expo dependencies.
 * 
 * Run with: npm test -- syncLogic.test.ts
 */

// Types for sync operations
interface QueuedRequest {
  id: number;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  body: string | null;
  headers: Record<string, string>;
  createdAt: number;
  retryCount: number;
}

interface SyncConflict {
  entityType: 'project' | 'note';
  entityId: string;
  localVersion: any;
  serverVersion: any;
  detectedAt: number;
  resolution: 'pending' | 'local' | 'server' | 'merged';
}

// Queue manager for offline requests
class RequestQueue {
  private queue: QueuedRequest[] = [];
  private idCounter = 0;

  add(request: Omit<QueuedRequest, 'id' | 'createdAt' | 'retryCount'>): number {
    const id = ++this.idCounter;
    this.queue.push({
      ...request,
      id,
      createdAt: Date.now(),
      retryCount: 0,
    });
    return id;
  }

  getPending(): QueuedRequest[] {
    return this.queue.filter(r => r.retryCount < 5);
  }

  getAll(): QueuedRequest[] {
    return [...this.queue];
  }

  markComplete(id: number): void {
    this.queue = this.queue.filter(r => r.id !== id);
  }

  incrementRetry(id: number): void {
    const request = this.queue.find(r => r.id === id);
    if (request) {
      request.retryCount++;
    }
  }

  hasExceededRetries(id: number, maxRetries: number = 5): boolean {
    const request = this.queue.find(r => r.id === id);
    return request ? request.retryCount >= maxRetries : false;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

// Conflict detector
class ConflictDetector {
  detectConflict(
    localUpdatedAt: number,
    serverUpdatedAt: number,
    syncedAt: number
  ): boolean {
    // Conflict if server was modified after our last sync
    // AND we have local changes
    return serverUpdatedAt > syncedAt && localUpdatedAt > syncedAt;
  }

  resolveByTimestamp(
    localData: any,
    serverData: any,
    localUpdatedAt: number,
    serverUpdatedAt: number
  ): { winner: 'local' | 'server'; data: any } {
    // Last-write-wins strategy
    if (localUpdatedAt >= serverUpdatedAt) {
      return { winner: 'local', data: localData };
    }
    return { winner: 'server', data: serverData };
  }
}

// Exponential backoff calculator
function calculateBackoff(
  retryCount: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

// Network connectivity simulation
class NetworkSimulator {
  private online = true;
  private listeners: ((online: boolean) => void)[] = [];

  setOnline(online: boolean): void {
    if (this.online !== online) {
      this.online = online;
      this.listeners.forEach(l => l(online));
    }
  }

  isOnline(): boolean {
    return this.online;
  }

  subscribe(callback: (online: boolean) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
}


describe('RequestQueue', () => {
  let queue: RequestQueue;

  beforeEach(() => {
    queue = new RequestQueue();
  });

  describe('add', () => {
    it('should add a request and return its ID', () => {
      const id = queue.add({
        method: 'POST',
        url: '/api/notes',
        body: JSON.stringify({ title: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(id).toBe(1);
      expect(queue.size()).toBe(1);
    });

    it('should assign incrementing IDs', () => {
      const id1 = queue.add({ method: 'POST', url: '/a', body: null, headers: {} });
      const id2 = queue.add({ method: 'POST', url: '/b', body: null, headers: {} });
      const id3 = queue.add({ method: 'POST', url: '/c', body: null, headers: {} });

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);
    });
  });

  describe('getPending', () => {
    it('should return requests under max retries', () => {
      queue.add({ method: 'POST', url: '/a', body: null, headers: {} });
      queue.add({ method: 'POST', url: '/b', body: null, headers: {} });

      const pending = queue.getPending();
      expect(pending).toHaveLength(2);
    });

    it('should exclude requests at max retries', () => {
      const id = queue.add({ method: 'POST', url: '/a', body: null, headers: {} });
      
      // Simulate 5 failed retries
      for (let i = 0; i < 5; i++) {
        queue.incrementRetry(id);
      }

      const pending = queue.getPending();
      expect(pending).toHaveLength(0);
    });
  });

  describe('markComplete', () => {
    it('should remove the request from queue', () => {
      const id = queue.add({ method: 'POST', url: '/a', body: null, headers: {} });
      queue.markComplete(id);

      expect(queue.size()).toBe(0);
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count', () => {
      const id = queue.add({ method: 'POST', url: '/a', body: null, headers: {} });
      
      queue.incrementRetry(id);
      queue.incrementRetry(id);

      const requests = queue.getAll();
      expect(requests[0].retryCount).toBe(2);
    });
  });

  describe('hasExceededRetries', () => {
    it('should return false for fresh requests', () => {
      const id = queue.add({ method: 'POST', url: '/a', body: null, headers: {} });
      expect(queue.hasExceededRetries(id)).toBe(false);
    });

    it('should return true after max retries', () => {
      const id = queue.add({ method: 'POST', url: '/a', body: null, headers: {} });
      
      for (let i = 0; i < 5; i++) {
        queue.incrementRetry(id);
      }

      expect(queue.hasExceededRetries(id)).toBe(true);
    });
  });
});


describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('detectConflict', () => {
    it('should detect conflict when both sides modified after sync', () => {
      const syncedAt = 1000;
      const localUpdatedAt = 2000;
      const serverUpdatedAt = 1500;

      expect(detector.detectConflict(localUpdatedAt, serverUpdatedAt, syncedAt)).toBe(true);
    });

    it('should not detect conflict when only local modified', () => {
      const syncedAt = 1000;
      const localUpdatedAt = 2000;
      const serverUpdatedAt = 500; // Before sync

      expect(detector.detectConflict(localUpdatedAt, serverUpdatedAt, syncedAt)).toBe(false);
    });

    it('should not detect conflict when only server modified', () => {
      const syncedAt = 1000;
      const localUpdatedAt = 500; // Before sync
      const serverUpdatedAt = 2000;

      expect(detector.detectConflict(localUpdatedAt, serverUpdatedAt, syncedAt)).toBe(false);
    });
  });

  describe('resolveByTimestamp', () => {
    it('should choose local when more recent', () => {
      const result = detector.resolveByTimestamp(
        { title: 'Local' },
        { title: 'Server' },
        2000, // Local is newer
        1000
      );

      expect(result.winner).toBe('local');
      expect(result.data.title).toBe('Local');
    });

    it('should choose server when more recent', () => {
      const result = detector.resolveByTimestamp(
        { title: 'Local' },
        { title: 'Server' },
        1000,
        2000 // Server is newer
      );

      expect(result.winner).toBe('server');
      expect(result.data.title).toBe('Server');
    });

    it('should choose local on tie (local preference)', () => {
      const result = detector.resolveByTimestamp(
        { title: 'Local' },
        { title: 'Server' },
        1000,
        1000 // Same time
      );

      expect(result.winner).toBe('local');
    });
  });
});


describe('calculateBackoff', () => {
  it('should return base delay for first retry', () => {
    const delay = calculateBackoff(0, 1000);
    expect(delay).toBeGreaterThanOrEqual(900);
    expect(delay).toBeLessThanOrEqual(1100);
  });

  it('should double delay for each retry', () => {
    const delay1 = calculateBackoff(1, 1000, 30000);
    const delay2 = calculateBackoff(2, 1000, 30000);
    
    // With jitter, roughly 2x and 4x
    expect(delay1).toBeGreaterThan(1500);
    expect(delay2).toBeGreaterThan(3000);
  });

  it('should cap at max delay', () => {
    const delay = calculateBackoff(10, 1000, 30000);
    expect(delay).toBeLessThanOrEqual(33000); // Max + 10% jitter
  });
});


describe('NetworkSimulator', () => {
  let network: NetworkSimulator;

  beforeEach(() => {
    network = new NetworkSimulator();
  });

  it('should start online', () => {
    expect(network.isOnline()).toBe(true);
  });

  it('should toggle offline', () => {
    network.setOnline(false);
    expect(network.isOnline()).toBe(false);
  });

  it('should notify subscribers on change', () => {
    const callback = jest.fn();
    network.subscribe(callback);
    
    network.setOnline(false);
    
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('should not notify on same state', () => {
    const callback = jest.fn();
    network.subscribe(callback);
    
    network.setOnline(true); // Already true
    
    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing', () => {
    const callback = jest.fn();
    const unsubscribe = network.subscribe(callback);
    
    unsubscribe();
    network.setOnline(false);
    
    expect(callback).not.toHaveBeenCalled();
  });
});
