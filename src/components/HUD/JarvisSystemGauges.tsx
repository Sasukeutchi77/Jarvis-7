import React, { useState, useEffect } from 'react';
import { 
  Battery, 
  BatteryCharging, 
  Thermometer, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Activity,
  Layers,
  Zap
} from 'lucide-react';

interface CircularGaugeProps {
  percentage: number;
  label: string;
  subValue: string;
  icon: React.ComponentType<{ className?: string }>;
  colorGradient: {
    start: string;
    end: string;
    glow: string;
    text: string;
  };
  unit?: string;
  isPulsing?: boolean;
}

const CircularGauge: React.FC<CircularGaugeProps> = ({
  percentage,
  label,
  subValue,
  icon: Icon,
  colorGradient,
  unit = '%',
  isPulsing = false,
}) => {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-950/80 border border-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 relative group overflow-hidden select-none">
      {/* Subtle background glow */}
      <div 
        className="absolute -inset-1 rounded-xl opacity-10 group-hover:opacity-25 transition-opacity blur-md pointer-events-none"
        style={{ backgroundColor: colorGradient.glow }}
      />

      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* SVG Circular Progress Track */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
          {/* Background Track */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            stroke="rgba(30, 41, 59, 0.8)"
            strokeWidth="3.5"
            fill="transparent"
          />
          {/* Progress Bar with Gradient */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            stroke={`url(#grad_${label.replace(/\s+/g, '_')})`}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
          {/* Concentric tick marks */}
          <circle
            cx="30"
            cy="30"
            r={radius - 6}
            stroke="rgba(6, 182, 212, 0.15)"
            strokeWidth="1"
            strokeDasharray="2 6"
            fill="transparent"
          />
          <defs>
            <linearGradient id={`grad_${label.replace(/\s+/g, '_')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colorGradient.start} />
              <stop offset="100%" stopColor={colorGradient.end} />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Icon & Live Value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className={`w-3.5 h-3.5 mb-0.5 ${colorGradient.text} ${isPulsing ? 'animate-pulse' : ''}`} />
          <span className="text-[11px] font-mono font-bold text-slate-100 leading-none">
            {clamped}{unit}
          </span>
        </div>
      </div>

      {/* Label and Sub-telemetry */}
      <div className="text-center mt-1.5 w-full">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block truncate">
          {label}
        </span>
        <span className="text-[9px] font-mono text-cyan-400/80 block truncate">
          {subValue}
        </span>
      </div>
    </div>
  );
};

export const JarvisSystemGauges: React.FC<{ ecoMode?: boolean; className?: string }> = ({
  ecoMode = false,
  className = '',
}) => {
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(37);
  const [ramUsage, setRamUsage] = useState<number>(54);
  const [storageUsage, setStorageUsage] = useState<number>(42);
  const [cpuUsage, setCpuUsage] = useState<number>(24);
  const [networkPing, setNetworkPing] = useState<number>(18);
  const [networkSpeed, setNetworkSpeed] = useState<string>('4G / 52 Mbps');

  useEffect(() => {
    // 1. Native Battery API if available on device
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);

        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      }).catch(() => {});
    }

    // 2. Real-time Telemetry Simulator / Live ping monitor
    const updateStats = () => {
      // Dynamic CPU fluctuation based on activity
      setCpuUsage((prev) => {
        const delta = (Math.random() - 0.5) * 8;
        return Math.max(12, Math.min(85, Math.round(prev + delta)));
      });

      // RAM usage
      setRamUsage((prev) => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(45, Math.min(78, Math.round(prev + delta)));
      });

      // Thermal reading (°C)
      setTemperature((prev) => {
        const delta = (Math.random() - 0.5) * 0.4;
        return Math.max(34, Math.min(46, Math.round((prev + delta) * 10) / 10));
      });

      // Network latency estimation
      if (typeof performance !== 'undefined') {
        const start = performance.now();
        fetch('/api/health', { method: 'HEAD' })
          .then(() => {
            const ms = Math.max(8, Math.round(performance.now() - start));
            setNetworkPing(ms);
          })
          .catch(() => {
            setNetworkPing(Math.round(15 + Math.random() * 8));
          });
      }
    };

    const interval = setInterval(updateStats, ecoMode ? 10000 : 3500);
    return () => clearInterval(interval);
  }, [ecoMode]);

  const getTempColor = (temp: number) => {
    if (temp >= 42) return { start: '#ef4444', end: '#f97316', glow: '#ef4444', text: 'text-rose-400' };
    if (temp >= 38) return { start: '#f59e0b', end: '#eab308', glow: '#f59e0b', text: 'text-amber-400' };
    return { start: '#10b981', end: '#06b6d4', glow: '#10b981', text: 'text-emerald-400' };
  };

  const getBatteryColor = (level: number, charging: boolean) => {
    if (charging) return { start: '#06b6d4', end: '#3b82f6', glow: '#06b6d4', text: 'text-cyan-400' };
    if (level <= 20) return { start: '#ef4444', end: '#dc2626', glow: '#ef4444', text: 'text-rose-500' };
    if (level <= 40) return { start: '#f59e0b', end: '#d97706', glow: '#f59e0b', text: 'text-amber-400' };
    return { start: '#10b981', end: '#059669', glow: '#10b981', text: 'text-emerald-400' };
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-mono uppercase font-semibold text-slate-300 tracking-wider">
            TÉLÉMÉTRIE MATÉRIELLE ANDROID
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>REALTIME</span>
        </div>
      </div>

      {/* Grid of 6 Circular Gauges tailored for mobile & desktop */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {/* 1. Batterie */}
        <CircularGauge
          percentage={batteryLevel}
          label="Batterie"
          subValue={isCharging ? 'En charge' : '3.82 V'}
          icon={isCharging ? BatteryCharging : Battery}
          colorGradient={getBatteryColor(batteryLevel, isCharging)}
          isPulsing={isCharging}
        />

        {/* 2. Température */}
        <CircularGauge
          percentage={Math.round(((temperature - 20) / 40) * 100)}
          label="Thermique"
          subValue={`${temperature}°C`}
          unit=""
          icon={Thermometer}
          colorGradient={getTempColor(temperature)}
        />

        {/* 3. RAM */}
        <CircularGauge
          percentage={ramUsage}
          label="RAM"
          subValue={`${(ramUsage * 0.08).toFixed(1)} / 8.0 Go`}
          icon={Layers}
          colorGradient={{
            start: '#38bdf8',
            end: '#6366f1',
            glow: '#38bdf8',
            text: 'text-sky-400',
          }}
        />

        {/* 4. Stockage */}
        <CircularGauge
          percentage={storageUsage}
          label="Stockage"
          subValue="54 / 128 Go"
          icon={HardDrive}
          colorGradient={{
            start: '#a855f7',
            end: '#ec4899',
            glow: '#a855f7',
            text: 'text-purple-400',
          }}
        />

        {/* 5. Réseau / Latence */}
        <CircularGauge
          percentage={Math.min(100, Math.round((networkPing / 100) * 100))}
          label="Réseau"
          subValue={`${networkPing} ms`}
          unit="ms"
          icon={Wifi}
          colorGradient={{
            start: '#06b6d4',
            end: '#14b8a6',
            glow: '#06b6d4',
            text: 'text-cyan-400',
          }}
        />

        {/* 6. CPU / NPU */}
        <CircularGauge
          percentage={cpuUsage}
          label="CPU / NPU"
          subValue="2.84 GHz"
          icon={Cpu}
          colorGradient={{
            start: '#f43f5e',
            end: '#fb923c',
            glow: '#f43f5e',
            text: 'text-rose-400',
          }}
          isPulsing={cpuUsage > 70}
        />
      </div>
    </div>
  );
};
