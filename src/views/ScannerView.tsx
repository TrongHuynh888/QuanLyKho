import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import {
  ScanLine,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  History,
  X,
} from "lucide-react";
import { motion } from "motion/react";

export default function ScannerView() {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<{id: string, data: string, time: string}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "reader";

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanner = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }
      
      setIsScanning(true);
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          toast.success(`${t("scanned_msg")}: ${decodedText}`);
          setScanHistory(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            data: decodedText,
            time: new Date().toLocaleTimeString()
          }, ...prev]);
          stopScanner();
        },
        (errorMessage) => {
          // Ignore frequent errors
        }
      );
    } catch (err) {
      console.error(err);
      toast.error(t("camera_error"));
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }
  };

  if (showHistory) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6 py-12">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("scan_history")}</h3>
          <button 
            onClick={() => setShowHistory(false)}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 transition-all"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          {scanHistory.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-500">
              <History size={48} className="mx-auto mb-4 opacity-20" />
              <p>{t("no_scans_yet")}</p>
            </div>
          ) : (
            scanHistory.map((item) => (
              <div key={item.id} className="p-4 bg-white dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-bold text-neutral-900 dark:text-neutral-50 truncate max-w-[200px]">{item.data}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{item.time}</p>
                </div>
                <div className="w-8 h-8 bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 rounded-lg flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col items-center gap-10 py-12">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("mobile_scanner")}</h3>
        <p className="text-neutral-400 dark:text-neutral-500 font-medium">{t("scan_instruction")}</p>
      </div>
      
      <div className="w-full aspect-square bg-neutral-900 rounded-[3rem] relative overflow-hidden flex flex-col items-center justify-center shadow-2xl shadow-neutral-200">
        <div id={scannerId} className="absolute inset-0 w-full h-full" />
        
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-20 bg-neutral-900/80 backdrop-blur-sm">
            <div className="w-24 h-24 bg-taika-blue/20 rounded-full flex items-center justify-center text-taika-blue dark:text-blue-400 animate-pulse">
              <ScanLine size={48} />
            </div>
            <button 
              onClick={startScanner}
              className="px-8 py-4 bg-taika-blue text-white rounded-2xl font-bold shadow-xl shadow-taika-blue/20 active:scale-95 transition-all"
            >
              {t("start_camera")}
            </button>
          </div>
        )}

        {isScanning && (
          <>
            <div className="absolute inset-0 border-[60px] border-black/40 pointer-events-none z-10" />
            <div className="w-72 h-72 border-2 border-taika-blue/50 rounded-[2rem] relative flex items-center justify-center z-10">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-taika-blue rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-taika-blue rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-taika-blue rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-taika-blue rounded-br-xl" />
              
              <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-1 bg-taika-blue shadow-[0_0_20px_rgba(0,74,153,1)] z-10"
              />
              
              <div className="w-48 h-48 opacity-20">
                <ScanLine size={192} className="text-taika-blue dark:text-blue-400" />
              </div>
            </div>
            <button 
              onClick={stopScanner}
              className="absolute bottom-10 px-6 py-2 bg-white/10 dark:bg-neutral-950/10 hover:bg-white/20 dark:bg-neutral-950/20 text-white rounded-full text-xs font-bold backdrop-blur-md transition-all z-20"
            >
              {t("stop_scanning")}
            </button>
          </>
        )}
      </div>

      <div className="w-full grid grid-cols-2 gap-4">
        <button className="flex flex-col items-center gap-3 p-6 bg-taika-blue text-white rounded-[2rem] font-bold shadow-xl shadow-taika-blue/10 active:scale-95 transition-all">
          <div className="w-12 h-12 bg-white/20 dark:bg-neutral-950/20 rounded-2xl flex items-center justify-center">
            <ArrowDownLeft size={24} />
          </div>
          <span>{t("inbound")}</span>
        </button>
        <button className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-neutral-950 border-2 border-neutral-100 dark:border-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-[2rem] font-bold shadow-sm active:scale-95 transition-all">
          <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-2xl flex items-center justify-center">
            <ArrowUpRight size={24} />
          </div>
          <span>{t("outbound")}</span>
        </button>
        <button 
          onClick={() => setShowHistory(true)}
          className="col-span-2 flex items-center justify-center gap-3 p-5 bg-neutral-900 text-white rounded-[2rem] font-bold active:scale-95 transition-all"
        >
          <History size={20} />
          <span>{t("scan_history")}</span>
        </button>
      </div>
    </div>
  );
}
