// src/utils/qrScanner.ts
// QR Code Scanner wrapper ใช้ jsQR library
// รองรับ Android LIFF WebView + fallback manual input

import jsQR from 'jsqr';

export interface QrScanResult {
  data:  string;
  error: string | null;
}

export interface ScannerOptions {
  onSuccess:  (payload: string) => void;
  onError?:   (err: string) => void;
  onFrame?:   () => void;         // callback ทุก frame (สำหรับ animation)
  facingMode?: 'environment' | 'user';
}

// ─────────────────────────────────────────────────────────────
// Android LIFF Camera Workaround Notes:
//
// 1. getUserMedia บน Android LINE WebView (LIFF) อาจ fail
//    ครั้งแรกหลัง resume — ต้องรอ 500ms แล้วลองใหม่
// 2. stream ต้องถูก stop ทุก track เมื่อ component unmount
//    มิฉะนั้นกล้องค้างสีเขียว (indicator ไม่ดับ)
// 3. video.play() ต้อง await และ catch error
//    บน Android บางรุ่น play() reject โดยไม่มีเหตุผล
// 4. ใช้ requestAnimationFrame แทน setInterval
//    เพื่อให้ browser จัดการ frame rate เอง
// 5. เมื่อ visibilitychange → hidden ให้ pauseScan()
//    เมื่อ visible → resumeScan() พร้อม reinit stream
// ─────────────────────────────────────────────────────────────

export class QrScanner {
  private video:          HTMLVideoElement | null = null;
  private canvas:         HTMLCanvasElement | null = null;
  private ctx:            CanvasRenderingContext2D | null = null;
  private stream:         MediaStream | null = null;
  private animFrame:      number | null = null;
  private isScanning:     boolean = false;
  private isPaused:       boolean = false;
  private options:        ScannerOptions;
  private visibilityHandler: (() => void) | null = null;

  constructor(options: ScannerOptions) {
    this.options = options;
  }

  // ─────────────────────────────────────────────────────────
  // Start scanning
  // ─────────────────────────────────────────────────────────
  async start(
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement
  ): Promise<void> {
    this.video  = videoEl;
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d', { willReadFrequently: true });

    await this._initStream();
    this._startLoop();
    this._bindVisibilityChange();
  }

  private async _initStream(retryCount = 0): Promise<void> {
    // Android workaround: รอ 500ms หลัง resume ก่อนขอ camera
    if (retryCount > 0) {
      await this._sleep(500);
    }

    try {
      // Stop existing stream ก่อน
      this._stopStream();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.options.facingMode ?? 'environment',
          width:      { ideal: 1280 },
          height:     { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!this.video) return;
      this.video.srcObject = this.stream;

      // Android: play() อาจ reject ให้ catch และ retry
      try {
        await this.video.play();
      } catch (playErr) {
        console.warn('[QrScanner] video.play() failed, retrying...', playErr);
        await this._sleep(300);
        await this.video.play();
      }

      this.isScanning = true;
      this.isPaused   = false;

    } catch (err: any) {
      if (retryCount < 2) {
        console.warn(`[QrScanner] getUserMedia failed (attempt ${retryCount + 1}), retrying...`);
        return this._initStream(retryCount + 1);
      }

      const msg = this._getUserMediaErrorMessage(err);
      this.options.onError?.(msg);
      throw new Error(msg);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Frame scan loop (requestAnimationFrame)
  // ─────────────────────────────────────────────────────────
  private _startLoop(): void {
    const scan = () => {
      if (!this.isScanning || this.isPaused) {
        this.animFrame = requestAnimationFrame(scan);
        return;
      }

      this.options.onFrame?.();

      const result = this._scanFrame();
      if (result) {
        // หยุด scan ชั่วคราวหลังพบ QR เพื่อป้องกัน double fire
        this.pauseScan();
        this.options.onSuccess(result);
        return; // ไม่ requestAnimationFrame ต่อ
      }

      this.animFrame = requestAnimationFrame(scan);
    };

    this.animFrame = requestAnimationFrame(scan);
  }

  private _scanFrame(): string | null {
    if (!this.video || !this.canvas || !this.ctx) return null;
    if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return null;

    // ปรับขนาด canvas ให้ตรงกับ video
    const { videoWidth, videoHeight } = this.video;
    if (videoWidth === 0 || videoHeight === 0) return null;

    this.canvas.width  = videoWidth;
    this.canvas.height = videoHeight;
    this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

    const imageData = this.ctx.getImageData(0, 0, videoWidth, videoHeight);
    const code = jsQR(imageData.data, videoWidth, videoHeight, {
      inversionAttempts: 'dontInvert'
    });

    return code?.data ?? null;
  }

  // ─────────────────────────────────────────────────────────
  // Android visibilitychange workaround
  // ─────────────────────────────────────────────────────────
  private _bindVisibilityChange(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[QrScanner] App hidden — pausing camera');
        this.pauseScan();
        this._stopStream();
      } else {
        console.log('[QrScanner] App visible — resuming camera');
        this._initStream().then(() => this.resumeScan());
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  // ─────────────────────────────────────────────────────────
  // Pause / Resume / Stop
  // ─────────────────────────────────────────────────────────
  pauseScan(): void {
    this.isPaused = true;
    if (this.video) this.video.pause();
  }

  async resumeScan(): Promise<void> {
    this.isPaused = false;
    if (this.video) {
      try { await this.video.play(); } catch {}
    }
    if (!this.animFrame) this._startLoop();
  }

  stop(): void {
    this.isScanning = false;
    this.isPaused   = true;

    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }

    this._stopStream();

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private _stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log(`[QrScanner] stopped track: ${track.kind}`);
      });
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  private _getUserMediaErrorMessage(err: any): string {
    const name = err?.name || '';
    if (name === 'NotAllowedError')     return 'ไม่ได้รับอนุญาตเข้าถึงกล้อง กรุณาเปิดสิทธิ์ใน Settings';
    if (name === 'NotFoundError')       return 'ไม่พบกล้องในอุปกรณ์นี้';
    if (name === 'NotReadableError')    return 'กล้องถูกใช้งานโดยแอปอื่นอยู่';
    if (name === 'OverconstrainedError')return 'ไม่รองรับความละเอียดที่ต้องการ';
    if (name === 'SecurityError')       return 'ต้องใช้ HTTPS เพื่อเข้าถึงกล้อง';
    return `เกิดข้อผิดพลาดกับกล้อง: ${err?.message || name}`;
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────────────────
  // Static: ตรวจสอบว่า device รองรับ camera
  // ─────────────────────────────────────────────────────────
  static async isSupported(): Promise<boolean> {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  // ─────────────────────────────────────────────────────────
  // Static: สแกนจาก image file (fallback สำหรับ Android ที่ camera ไม่ work)
  // ─────────────────────────────────────────────────────────
  static async scanFromFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width  = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, img.width, img.height);
          resolve(code?.data ?? null);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }
}
