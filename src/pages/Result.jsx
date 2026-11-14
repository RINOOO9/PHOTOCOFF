import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, RotateCcw, X, Link, ArrowRight, QrCode, Play, Image, Film } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePhotography } from '../context/PhotographyContext';
import {
  FRAME_CONFIGS,
  getFrameImagePath,
  chromaKeyFrame,
  composeCanvas,
  composePlainCanvas,
  downloadDataUrl,
  downloadBlobUrl,
} from '../utils/frameUtils';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.115-2.906-6.99C16.257 1.875 13.777 1.84 11.994 1.84c-5.438 0-9.863 4.42-9.867 9.864 0 1.73.465 3.42 1.345 4.922L2.463 20.35l3.96-.91c-.001-.285-.001-1.077 0-1.077-.042.062.137-.091.224-.131z" />
    <path d="M17.472 14.382c-.302-.151-1.787-.882-2.063-.982-.277-.1-.478-.151-.68.151-.202.302-.782.982-.96 1.182-.178.2-.355.226-.657.076-.301-.15-1.272-.469-2.422-1.494-.894-.797-1.498-1.782-1.674-2.083-.177-.302-.019-.465.132-.615.136-.135.302-.353.454-.53.151-.177.202-.302.302-.503.101-.2.05-.377-.025-.527-.075-.15-.68-1.64-.932-2.245-.246-.59-.496-.51-.68-.52-.177-.01-.38-.01-.583-.01-.203 0-.533.076-.812.379-.279.302-1.065 1.042-1.065 2.541s1.09 2.946 1.242 3.147c.152.202 2.146 3.277 5.197 4.59.726.313 1.292.5 1.735.64.73.232 1.393.199 1.918.121.585-.087 1.787-.73 2.039-1.433.253-.703.253-1.306.177-1.432-.076-.127-.279-.203-.581-.354z" />
  </svg>
);

const InstagramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const TABS = [
  { id: 'live', label: 'Live Photo', icon: Play },
  { id: 'photo', label: 'Photo', icon: Image },
  { id: 'gif', label: 'GIF', icon: Film },
];

const Result = () => {
  const resultRef = useRef(null);
  const navigate = useNavigate();
  const { photos, photoCount, frame, framePhotosMapping, resetAll, liveClips } = usePhotography();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isWhatsAppFormOpen, setIsWhatsAppFormOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [processedFrame, setProcessedFrame] = useState(null);

  // Tab mode
  const [activeTab, setActiveTab] = useState('photo');

  // GIF slideshow (no frame, plain photos)
  const [gifIndex, setGifIndex] = useState(0);

  useEffect(() => {
    chromaKeyFrame(getFrameImagePath(frame)).then(setProcessedFrame);
  }, [frame]);

  // GIF auto-slideshow timer (no frame)
  useEffect(() => {
    if (activeTab !== 'gif') return;
    const timer = setInterval(() => {
      setGifIndex(prev => (prev + 1) % photoCount);
    }, 700);
    return () => clearInterval(timer);
  }, [activeTab, photoCount]);

  if (!photos || photos.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center">
        <button onClick={() => navigate('/')} className="text-wood hover:text-wood/60 transition-colors font-sans text-xs uppercase tracking-widest cursor-pointer">
          No photos found. Go back to start.
        </button>
      </div>
    );
  }

  const configs = FRAME_CONFIGS[frame] || FRAME_CONFIGS.frame3_1;

  // Duplicated photos for frame slots (left+right)
  const duplicatedPhotos = [];
  for (let i = 0; i < photoCount; i++) {
    const mi = framePhotosMapping?.[i] ?? i;
    duplicatedPhotos.push(photos[mi]); duplicatedPhotos.push(photos[mi]);
  }

  const getFrameImage = () => processedFrame || getFrameImagePath(frame);

  const isLiveTab = activeTab === 'live';
  const isPhotoTab = activeTab === 'photo';
  const isGifTab = activeTab === 'gif';

  const handleDownload = async () => {
    try {
      if (isLiveTab && liveClips && liveClips.length > 0) {
        // Download all live video clips sequentially
        for (let i = 0; i < liveClips.length; i++) {
          await new Promise(r => setTimeout(r, i * 600));
          downloadBlobUrl(liveClips[i], `photocoff-live-${i + 1}-${Date.now()}.webm`);
        }
        return;
      }
      if (isGifTab) {
        // Format sama dengan tampilan take-photo (kotak 4:3)
        const canvas = await composePlainCanvas(photos[gifIndex], 1280, 960);
        downloadDataUrl(canvas.toDataURL('image/png', 1.0), `photocoff-gif-${Date.now()}.png`);
        return;
      }
      // Photo mode: canvas compose with frame
      const canvas = await composeCanvas(photos, photoCount, frame, framePhotosMapping, processedFrame);
      downloadDataUrl(canvas.toDataURL('image/png', 1.0), `photocoff-${Date.now()}.png`);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleShare = async () => {
    try {
      let canvas;
      if (isPhotoTab) {
        canvas = await composeCanvas(photos, photoCount, frame, framePhotosMapping, processedFrame);
      } else {
        canvas = await composePlainCanvas(photos[0], 1280, 960);
      }
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png', 1.0));
      const file = new File([blob], `photocoff-${Date.now()}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'PhotoCoff' });
      } else {
        setIsShareModalOpen(true);
      }
    } catch {
      setIsShareModalOpen(true);
    }
  };

  const sendWhatsAppDirect = () => {
    if (!whatsappNumber.trim()) return;
    let num = whatsappNumber.replace(/[^0-9]/g, '');
    if (num.startsWith('0')) num = '62' + num.substring(1);
    const text = `Look at my photobooth from PhotoCoff! ${window.location.origin}/recap`;
    window.open(`https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(text)}`, '_blank');
    setIsWhatsAppFormOpen(false); setIsShareModalOpen(false);
  };

  const shareInstagram = () => {
    navigator.clipboard.writeText(`${window.location.origin}/recap`);
    setShowToast(true); setTimeout(() => setShowToast(false), 2500);
    window.open('https://www.instagram.com/', '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/recap`);
    setShowToast(true); setTimeout(() => setShowToast(false), 2500);
  };

  const handleStartOver = () => { resetAll(); navigate('/'); };

  const recapUrl = `${window.location.origin}/recap`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=30150e&bgcolor=faf0e6&data=${encodeURIComponent(recapUrl)}`;

  return (
    <div className="min-h-screen bg-silk py-6 sm:py-8 px-4 flex flex-col items-center justify-center gap-5 sm:gap-6 font-sans relative overflow-y-auto">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-40 mix-blend-overlay z-0" style={{ backgroundImage: "url('/bg_landingpage.png')" }} />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1.5 flex-shrink-0 relative z-10">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-bold text-wood">There u go!</h1>
        <div className="h-[1px] w-10 sm:w-12 bg-wood/20 mx-auto" />
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-[950px] flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 px-2 relative z-10">
        {/* Left: Frame Preview + Tabs */}
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <div ref={resultRef} className="bg-white p-2.5 pb-3 sm:p-3.5 sm:pb-4 md:p-4 md:pb-5 shadow-[0_20px_50px_rgba(48,21,14,0.06)] rounded-sm flex flex-col gap-2 items-center justify-center">
            <div className={`relative h-[42vh] sm:h-[50vh] md:h-[56vh] max-h-[580px] ${isGifTab ? 'aspect-[4/3]' : 'aspect-[2/3]'} overflow-hidden bg-wood/5 rounded-sm`}>

              {/* Live Photo mode: each slot shows its own video clip within frame design */}
              {isLiveTab && configs.map((config, slotIndex) => {
                const clipIndex = Math.floor(slotIndex / 2);
                const clipSrc = liveClips && liveClips[clipIndex] ? liveClips[clipIndex] : null;
                if (!clipSrc) return null;
                return (
                  <div key={slotIndex} style={{ position: 'absolute', top: config.top, left: config.left, width: config.width, height: config.height, zIndex: 0 }} className="overflow-hidden">
                    <video
                      src={clipSrc}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                    />
                  </div>
                );
              })}
              {isLiveTab && (
                <img src={getFrameImage()} className="absolute inset-0 w-full h-full object-fill" style={{ zIndex: 2 }} alt="Frame" />
              )}

              {/* Photo mode: photos in frame slots WITH frame */}
              {isPhotoTab && configs.map((config, index) => {
                const src = duplicatedPhotos[index];
                if (!src) return null;
                return (
                  <div key={index} style={{ position: 'absolute', top: config.top, left: config.left, width: config.width, height: config.height, zIndex: 1 }} className="overflow-hidden">
                    <img src={src} className="w-full h-full object-cover" alt={`Slot ${index + 1}`} />
                  </div>
                );
              })}
              {isPhotoTab && (
                <img src={getFrameImage()} className="absolute inset-0 w-full h-full object-fill" style={{ zIndex: 2 }} alt="Frame" />
              )}

              {/* GIF mode: photos WITHOUT frame, plain box like take-photo view */}
              {isGifTab && (
                <img
                  src={photos[gifIndex]}
                  className="absolute inset-0 w-full h-full object-cover"
                  alt={`GIF ${gifIndex + 1}`}
                />
              )}
            </div>

          </div>

          {/* Tab Switcher */}
          <div className="flex bg-[#EFE6DC] rounded-full p-1 gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const disabled = tab.id === 'live' && (!liveClips || liveClips.length === 0);
              return (
                <button
                  key={tab.id}
                  onClick={() => !disabled && setActiveTab(tab.id)}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${
                    isActive ? 'bg-[#30150E] text-white shadow-md' : disabled ? 'text-wood/25 cursor-not-allowed' : 'text-wood/60 hover:text-wood hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* GIF photo selector */}
          {isGifTab && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setGifIndex(i)}
                  className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${gifIndex === i ? 'border-[#91545B] ring-2 ring-[#91545B]/20' : 'border-wood/10 hover:border-wood/30'}`}
                >
                  <img src={photos[i]} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: QR + Actions */}
        <div className="flex flex-col gap-4 sm:gap-5 w-full max-w-sm md:w-[300px] shrink-0">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="bg-[#FAF0E6]/95 backdrop-blur-sm rounded-[24px] border border-wood/10 p-5 sm:p-6 flex flex-col items-center text-center shadow-[0_15px_30px_rgba(48,21,14,0.04)]">
            <div className="w-10 h-10 rounded-full bg-[#FCE6DF] flex items-center justify-center text-[#91545B] mb-3">
              <QrCode className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3 className="text-base sm:text-lg font-serif font-bold text-wood">Scan for Recap</h3>
            <p className="text-[10px] sm:text-xs text-[#725A54] mt-1 mb-4 leading-relaxed font-sans max-w-[220px]">
              Scan to view recap & save all outputs to your gallery!
            </p>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/recap')} className="bg-white p-3 rounded-[20px] border border-wood/10 shadow-sm cursor-pointer relative group" title="Open Recap">
              <img src={qrImageUrl} className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl" alt="QR" />
              <div className="absolute inset-0 bg-[#30150E]/0 group-hover:bg-[#30150E]/2 rounded-[20px] transition-colors" />
            </motion.div>
            <button onClick={() => navigate('/recap')} className="mt-3 flex items-center gap-1.5 text-[10px] sm:text-xs text-[#91545B] hover:text-[#7a4249] font-sans font-bold uppercase tracking-widest transition-colors cursor-pointer">
              Open Recap <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2 sm:gap-3 w-full">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDownload} className="flex-1 flex items-center justify-center gap-1.5 bg-[#30150E] text-[#FDFBF9] py-2.5 sm:py-3 rounded-full font-sans text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] shadow-[0_10px_20px_rgba(48,21,14,0.15)] cursor-pointer">
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                DOWNLOAD
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleShare} className="flex-1 flex items-center justify-center gap-1.5 bg-[#530F0E] text-[#FDFBF9] py-2.5 sm:py-3 rounded-full font-sans text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] shadow-[0_10px_20px_rgba(83,15,14,0.15)] cursor-pointer">
                <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                SHARE
              </motion.button>
            </div>
            <button onClick={handleStartOver} className="flex items-center gap-2 text-wood/50 hover:text-wood transition-colors font-sans text-[8px] sm:text-[9px] uppercase tracking-[0.15em] font-bold cursor-pointer">
              <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} /> START OVER
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsShareModalOpen(false); setIsWhatsAppFormOpen(false); }} className="absolute inset-0 bg-wood/75 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-[#FDFBF9] w-full max-w-md rounded-[20px] sm:rounded-[28px] shadow-2xl p-5 sm:p-6 md:p-8 flex flex-col items-center border border-wood/5 z-10">
              <button onClick={() => { setIsShareModalOpen(false); setIsWhatsAppFormOpen(false); }} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-wood/40 hover:text-wood transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>

              {isWhatsAppFormOpen ? (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="text-center w-full mb-2">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#E8F8F0] flex items-center justify-center mx-auto mb-3 text-[#25D366] shadow-sm"><WhatsAppIcon className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-wood">Send to WhatsApp</h3>
                    <p className="text-[10px] sm:text-xs text-wood/65 mt-1 font-sans leading-relaxed">Enter phone number to send recap link.</p>
                  </div>
                  <div className="w-full space-y-3">
                    <input type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="e.g. 08123456789" className="w-full px-4 py-3 bg-[#FFF9F6] border border-wood/10 rounded-xl font-sans text-xs sm:text-sm text-wood focus:outline-none focus:ring-2 focus:ring-[#91545B]/20 focus:border-[#91545B] transition-all" autoFocus />
                    <div className="flex gap-2.5 pt-2">
                      <button onClick={() => setIsWhatsAppFormOpen(false)} className="flex-1 py-2.5 border border-wood/10 hover:bg-wood/5 rounded-xl font-sans text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-wood/60 cursor-pointer">Back</button>
                      <button onClick={sendWhatsAppDirect} className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl font-sans text-[10px] sm:text-[11px] font-bold uppercase tracking-widest shadow-md cursor-pointer">Send</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="text-center w-full mb-4 sm:mb-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#FCE6DF] flex items-center justify-center mx-auto mb-3 sm:mb-4 animate-bounce"><Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#91545B]" /></div>
                    <h3 className="text-xl sm:text-2xl font-serif font-bold text-wood">Share Your Portrait</h3>
                  </div>
                  <div className="flex flex-col gap-2.5 sm:gap-3.5 w-full">
                    <button onClick={() => setIsWhatsAppFormOpen(true)} className="w-full flex items-center justify-between p-3 sm:p-4 bg-[#E8F8F0] hover:bg-[#D5F2E1] rounded-[14px] sm:rounded-[18px] group cursor-pointer border border-[#c3ecd4]">
                      <div className="flex items-center gap-2.5 sm:gap-3.5"><div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-md"><WhatsAppIcon className="w-4 h-4 sm:w-5 sm:h-5" /></div><div className="text-left"><div className="text-[11px] sm:text-[13px] font-bold text-wood font-sans">WhatsApp</div></div></div>
                      <ArrowRight className="w-3.5 h-3.5 text-wood/40 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button onClick={shareInstagram} className="w-full flex items-center justify-between p-3 sm:p-4 bg-[#FFF0F3] hover:bg-[#FFE0E6] rounded-[14px] sm:rounded-[18px] group cursor-pointer border border-[#ffd2dc]">
                      <div className="flex items-center gap-2.5 sm:gap-3.5"><div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[#FD1D1D] via-[#F56040] to-[#E1306C] text-white flex items-center justify-center shadow-md"><InstagramIcon className="w-4 h-4 sm:w-5 sm:h-5" /></div><div className="text-left"><div className="text-[11px] sm:text-[13px] font-bold text-wood font-sans">Instagram</div></div></div>
                      <ArrowRight className="w-3.5 h-3.5 text-wood/40 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button onClick={copyLink} className="w-full flex items-center justify-between p-3 sm:p-4 bg-[#FFF9F6] hover:bg-[#FCE6DF] rounded-[14px] sm:rounded-[18px] group cursor-pointer border border-wood/5">
                      <div className="flex items-center gap-2.5 sm:gap-3.5"><div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#30150E] text-white flex items-center justify-center shadow-md"><Link className="w-4 h-4" /></div><div className="text-left"><div className="text-[11px] sm:text-[13px] font-bold text-wood font-sans">Copy Link</div></div></div>
                      <ArrowRight className="w-3.5 h-3.5 text-wood/40 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} className="fixed bottom-6 sm:bottom-8 z-[60] bg-[#30150E] text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase shadow-xl flex items-center gap-2 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Link Copied!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Result;
