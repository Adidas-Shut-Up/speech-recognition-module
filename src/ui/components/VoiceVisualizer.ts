export class VoiceVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isAnimating = false;
  private animationFrameId: number | null = null;
  private volumeLevel = 0;

  constructor(container: HTMLElement, width = 200, height = 200) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.className = 'voice-visualizer';
    
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);
  }

  updateVolume(volume: number): void {
    this.volumeLevel = Math.max(0, Math.min(1, volume));
    
    if (!this.isAnimating) {
      this.startAnimation();
    }
  }

  private startAnimation(): void {
    this.isAnimating = true;
    this.animate();
  }

  private stopAnimation(): void {
    this.isAnimating = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animate(): void {
    if (!this.isAnimating) return;

    this.clearCanvas();
    this.drawVisualization();
    
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawVisualization(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) - 10;
    
    // Рисуем базовый круг
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, maxRadius * 0.7, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(66, 133, 244, 0.1)';
    this.ctx.fill();
    
    // Рисуем волны в зависимости от уровня громкости
    const waveCount = 3;
    for (let i = 0; i < waveCount; i++) {
      const radius = maxRadius * 0.7 + (this.volumeLevel * maxRadius * 0.3 * (i + 1) / waveCount);
      const alpha = 0.3 - (i * 0.1);
      
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(66, 133, 244, ${alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
    
    // Рисуем индикатор уровня
    const indicatorRadius = maxRadius * 0.3 + (this.volumeLevel * maxRadius * 0.4);
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, indicatorRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(66, 133, 244, ${0.3 + this.volumeLevel * 0.7})`;
    this.ctx.fill();
  }

  reset(): void {
    this.volumeLevel = 0;
    this.clearCanvas();
    this.stopAnimation();
  }

  destroy(): void {
    this.stopAnimation();
    this.canvas.remove();
  }
}
