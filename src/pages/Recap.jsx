import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, Camera, Trash2, RefreshCw, Film, Sparkles, Heart,
  Download, Play, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePhotography } from '../context/PhotographyContext';
import {
  FRAME_CONFIGS,
  getFrameImagePath,
  chromaKeyFrame,
  composeCanvas,
  composePlainCanvas,
  generateGifVideo,
  downloadDataUrl,
  downloadBlobUrl,
} from '../utils/frameUtils';

const handleDownloadSingle = (dataUrl, name) => {
  downloadDataUrl(dataUrl, `${name}-${Date.now()}.jpg`);
};

const TABS = [
  { id: 'live', label: 'Live Photo', icon: Play },
  { id: 'photo', label: 'Photo', icon: ImageIcon },
  { id: 'gif', label: 'GIF', icon: Film },
];

const Recap = () => {
  const navigate = useNavigate();
  const {
    photos, photoCount, frame, framePhotosMapping,
    liveClips, deletedPhotos, retakenPhotos, resetAll,
  } = usePhotography();

  // Output preview state
  const [activeTab, setActiveTab] = useState('live');
  const [processedFrame, setProcessedFrame] = useState(null);
  const [composedPhoto, setComposedPhoto] = useState(null);
  const [gifIndex, setGifIndex] = useState(0);

  // Save-all state
  const [saveState, setSaveState] = useState('idle'); // idle | saving | done | error
  const [saveStep, setSaveStep] = useState('');
  const [toast, setToast] = useState('');

  const hasPhotos = photos && photos.length > 0;
  const hasLive = liveClips && liveClips.length > 0;
  const configs = FRAME_CONFIGS[frame] || FRAME_CONFIGS.frame3_1;

  // Duplicated photos for frame slots (left+right)
  const duplicatedPhotos = [];
  for (let i = 0; i < photoCount; i++) {
    const mi = framePhotosMapping?.[i] ?? i;
    duplicatedPhotos.push(photos[mi]); duplicatedPhotos.push(photos[mi]);
  }

  // Process frame + compose framed photo once
  useEffect(() => {
    if (!hasPhotos) return;
    let cancelled = false;
    chromaKeyFrame(getFrameImagePath(frame)).then(async (keyed) => {
      if (cancelled) return;
      setProcessedFrame(keyed);
      try {
        const canvas = await composeCanvas(photos, photoCount, frame, framePhotosMapping, keyed);
        if (!cancelled) setComposedPhoto(canvas.toDataURL('image/png', 1.0));
      } catch {
        /* preview photo optional */
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPhotos]);

  // GIF slideshow timer (plain photos, tanpa frame)
  useEffect(() => {
    if (activeTab !== 'gif' || !hasPhotos || photos.length <= 1) return;
    const timer = setInterval(() => {
      setGifIndex(prev => (prev + 1) % photos.length);
    }, 700);
    return () => clearInterval(timer);
  }, [activeTab, hasPhotos, photos]);

  const getFrameImage = () => processedFrame || getFrameImagePath(frame);

  const isLiveTab = activeTab === 'live';
  const isPhotoTab = activeTab === 'photo';
  const isGifTab = activeTab === 'gif';

  const handleStartOver = () => { resetAll(); navigate('/'); };

  // Unduh output Photo (frame) — dipakai tombol per-section & Save All
  const downloadPhotoOutput = async () => {
    let dataUrl = composedPhoto;
    if (!dataUrl) {
      const canvas = await composeCanvas(photos, photoCount, frame, framePhotosMapping, processedFrame);
      dataUrl = canvas.toDataURL('image/png', 1.0);
    }
    downloadDataUrl(dataUrl, `photocoff-${Date.now()}.png`);
  };

  // Unduh semua output ke galeri: Photo (frame) → GIF (video) → Live Photo (clips)
  const handleSaveAll = async () => {
    if (saveState === 'saving') return;
    try {
      setSaveState('saving');

      setSaveStep('Photo');
      await downloadPhotoOutput();
      await new Promise(r => setTimeout(r, 600));

      setSaveStep('GIF');
      try {
        const blob = await generateGifVideo(photos);
        downloadBlobUrl(URL.createObjectURL(blob), `photocoff-gif-${Date.now()}.webm`);
      } catch {
        // Fallback: simpan tiap frame foto secara terpisah (kotak 4:3)
        for (let i = 0; i < photos.length; i++) {
          const canvas = await composePlainCanvas(photos[i], 1280, 960);
          downloadDataUrl(canvas.toDataURL('image/png', 1.0), `photocoff-gif-frame-${i + 1}-${Date.now()}.png`);
          await new Promise(r => setTimeout(r, 400));
        }
      }
      await new Promise(r => setTimeout(r, 600));

      setSaveStep('Live Photo');
      if (hasLive) {
        for (let i = 0; i < liveClips.length; i++) {
          downloadBlobUrl(liveClips[i], `photocoff-live-${i + 1}-${Date.now()}.webm`);
          await new Promise(r => setTimeout(r, 600));
        }
      }

      setSaveState('done');
      setToast('All outputs saved to your gallery!');
      setTimeout(() => { setToast(''); setSaveState('idle'); }, 3000);
    } catch (err) {
      console.error('Save all error:', err);
      setSaveState('error');
      setToast('Something went wrong. Please try again.');
      setTimeout(() => { setToast(''); setSaveState('idle'); }, 3000);
    } finally {
      setSaveStep('');
    }
  };

  // Combine deleted and retaken photos into unselected list
  const unselectedPhotos = [
    ...(deletedPhotos || []).map((p, i) => ({ src: p, label: `Deleted #${i + 1}`, type: 'deleted' })),
    ...(retakenPhotos || []).map((p, i) => ({ src: p, label: `Retaken #${i + 1}`, type: 'retaken' })),
  ];

  return (
    <div className="min-h-screen bg-silk text-wood font-sans py-6 sm:py-10 md:py-16 px-4 sm:px-6 relative overflow-y-auto flex flex-col items-center justify-start">
      {/* Decorative background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-40 mix-blend-overlay z-0"
        style={{ backgroundImage: "url('/bg_landingpage.png')" }}
      />

      <div className="max-w-4xl w-full space-y-8 sm:space-y-12 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-2 sm:space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-wood/5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#91545B] border border-wood/5">
            <Sparkles className="w-3 h-3 text-[#91545B]" />
            Session Complete
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-bold text-wood tracking-tight">
            Digital Recap &amp; Memory
          </h1>
          <p className="text-wood/65 text-xs sm:text-sm max-w-md mx-auto font-sans leading-relaxed">
            Save all your outputs — Live Photo, framed Photo, and GIF — straight to your gallery below.
          </p>
          <div className="h-[1px] w-12 bg-[#91545B]/30 mx-auto mt-4" />
        </motion.div>

        {!hasPhotos ? (
          /* Empty Session State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#FAF0E6]/90 backdrop-blur-md rounded-[28px] p-8 text-center border border-wood/10 max-w-md mx-auto shadow-xl space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-[#FCE6DF] flex items-center justify-center mx-auto text-[#91545B]">
              <Film className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold">No Photos Found</h2>
              <p className="text-sm text-wood/65 leading-relaxed font-sans">
                It looks like you don&apos;t have any photos from this session yet. Let&apos;s take some beautiful shots!
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStartOver}
              className="w-full py-3.5 bg-[#30150E] text-white rounded-full font-bold uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-[#200e09] transition-colors font-sans"
            >
              <Camera className="w-4 h-4" />
              START SESSION
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-8 sm:space-y-12 max-w-2xl mx-auto w-full">

            {/* Save All to Gallery */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="bg-[#30150E] text-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 shadow-[0_20px_50px_rgba(48,21,14,0.2)] flex flex-col items-center text-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                {saveState === 'saving' ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : saveState === 'done' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : saveState === 'error' ? (
                  <AlertCircle className="w-6 h-6 text-red-400" />
                ) : (
                  <Download className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold">Save All to Gallery</h2>
                <p className="text-[10px] sm:text-xs text-white/60 mt-1 font-sans">
                  1 framed photo + 1 GIF video {hasLive ? `+ ${liveClips.length} live clip${liveClips.length > 1 ? 's' : ''}` : ''} will be downloaded.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: saveState === 'saving' ? 1 : 1.02 }}
                whileTap={{ scale: saveState === 'saving' ? 1 : 0.98 }}
                onClick={handleSaveAll}
                className={`w-full max-w-xs py-3.5 rounded-full font-bold uppercase tracking-widest text-[10px] sm:text-xs shadow-lg flex items-center justify-center gap-2 font-sans transition-colors ${
                  saveState === 'saving'
                    ? 'bg-white/20 text-white/70 cursor-not-allowed'
                    : 'bg-[#91545B] hover:bg-[#7a4249] text-white cursor-pointer'
                }`}
              >
                {saveState === 'saving' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SAVING {saveStep.toUpperCase()}...
                  </>
                ) : saveState === 'done' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ALL SAVED!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    DOWNLOAD ALL OUTPUTS
                  </>
                )}
              </motion.button>
            </motion.div>

            {/* Output Preview Panel (3 tabs) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-[#FAF0E6]/95 backdrop-blur-md rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 border border-wood/10 shadow-[0_15px_35px_rgba(48,21,14,0.04)] flex flex-col items-center"
            >
              {/* Tab switcher */}
              <div className="flex bg-[#EFE6DC] rounded-full p-1 gap-1 mb-5">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const disabled = tab.id === 'live' && !hasLive;
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

              {/* Preview area */}
              <div className={`relative w-full max-w-[360px] mx-auto ${isGifTab ? 'aspect-[4/3] max-w-[480px]' : 'aspect-[2/3]'} bg-wood/5 overflow-hidden rounded-lg shadow-inner`}>
                {/* Live Photo: clips in their frame slots */}
                {isLiveTab && configs.map((config, slotIndex) => {
                  const clipIndex = Math.floor(slotIndex / 2);
                  const clipSrc = hasLive && liveClips[clipIndex] ? liveClips[clipIndex] : null;
                  if (!clipSrc) return null;
                  return (
                    <div
                      key={slotIndex}
                      style={{ position: 'absolute', top: config.top, left: config.left, width: config.width, height: config.height, zIndex: 0 }}
                      className="overflow-hidden"
                    >
                      <video src={clipSrc} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="auto" />
                    </div>
                  );
                })}
                {isLiveTab && (
                  <img src={getFrameImage()} className="absolute inset-0 w-full h-full object-fill" style={{ zIndex: 2 }} alt="Frame" />
                )}

                {/* Photo: framed composition */}
                {isPhotoTab && duplicatedPhotos.map((src, index) => {
                  const config = configs[index];
                  if (!src || !config) return null;
                  return (
                    <div
                      key={index}
                      style={{ position: 'absolute', top: config.top, left: config.left, width: config.width, height: config.height, zIndex: 1 }}
                      className="overflow-hidden"
                    >
                      <img src={src} className="w-full h-full object-cover" alt={`Slot ${index + 1}`} />
                    </div>
                  );
                })}
                {isPhotoTab && (
                  <img src={getFrameImage()} className="absolute inset-0 w-full h-full object-fill" style={{ zIndex: 2 }} alt="Frame" />
                )}

                {/* GIF: plain full-screen photo cycling */}
                {isGifTab && photos[gifIndex] && (
                  <img
                    src={photos[gifIndex]}
                    className="absolute inset-0 w-full h-full object-cover"
                    alt={`GIF ${gifIndex + 1}`}
                  />
                )}
              </div>

              {/* Per-output download button */}
              <div className="w-full pt-5 mt-5 border-t border-wood/10 flex justify-center">
                {isLiveTab && (
                  <button
                    onClick={() => {
                      liveClips.forEach((clip, i) => {
                        setTimeout(() => downloadBlobUrl(clip, `photocoff-live-${i + 1}-${Date.now()}.webm`), i * 600);
                      });
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#30150E] text-white rounded-full font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-[#200e09] transition-colors font-sans"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download {liveClips.length} Live Clip{liveClips.length > 1 ? 's' : ''}
                  </button>
                )}
                {isPhotoTab && (
                  <button
                    onClick={downloadPhotoOutput}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#30150E] text-white rounded-full font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-[#200e09] transition-colors font-sans"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Framed Photo
                  </button>
                )}
                {isGifTab && (
                  <button
                    onClick={async () => {
                      const blob = await generateGifVideo(photos);
                      downloadBlobUrl(URL.createObjectURL(blob), `photocoff-gif-${Date.now()}.webm`);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#30150E] text-white rounded-full font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-[#200e09] transition-colors font-sans"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download GIF (Video)
                  </button>
                )}
              </div>
            </motion.div>

            {/* Selected Photos Gallery (individual download) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-[#FAF0E6]/95 backdrop-blur-md rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 md:p-8 border border-wood/10 shadow-[0_20px_50px_rgba(48,21,14,0.04)] space-y-6"
            >
              <div className="pb-4 border-b border-wood/10">
                <h3 className="text-lg sm:text-xl font-bold font-serif text-wood">
                  Selected Layout Photos
                </h3>
                <p className="text-[10px] sm:text-xs text-wood/60 font-sans mt-0.5">
                  These photos are featured in your chosen frame layout.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {photos.map((src, index) => (
                  <div
                    key={index}
                    className="group relative bg-white p-2 rounded-xl shadow-xs border border-wood/5 overflow-hidden flex flex-col gap-2 transition-all duration-300"
                  >
                    <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-wood/5 relative">
                      <img
                        src={src}
                        className="w-full h-full object-cover scale-x-[-1] grayscale-[0.02]"
                        alt={`Selected ${index + 1}`}
                      />
                    </div>

                    {/* Action Panel */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] sm:text-[9px] font-sans font-bold text-wood/40 uppercase tracking-widest">
                        PHOTO #{index + 1}
                      </span>
                      <button
                        onClick={() => handleDownloadSingle(src, `selected-${index + 1}`)}
                        className="p-1 bg-[#FAF0E6] hover:bg-[#F3A0AA]/20 text-[#91545B] hover:text-[#7a4249] rounded-md transition-colors cursor-pointer"
                        title="Download Photo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Unselected Photos (Deleted & Retaken) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-[#FAF0E6]/95 backdrop-blur-md rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 md:p-8 border border-wood/10 shadow-[0_20px_50px_rgba(48,21,14,0.04)] space-y-6"
            >
              <div className="pb-4 border-b border-wood/10">
                <h3 className="text-lg sm:text-xl font-bold font-serif text-wood">
                  Saves from Studio (Unused Poses)
                </h3>
                <p className="text-[10px] sm:text-xs text-wood/60 font-sans mt-0.5">
                  These photos were deleted or retaken, but you can still download them here!
                </p>
              </div>

              {unselectedPhotos.length === 0 ? (
                <div className="py-10 text-center text-wood/40 font-sans text-xs uppercase tracking-widest">
                  No unselected photos in this session.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {unselectedPhotos.map((item, index) => (
                    <div
                      key={index}
                      className="group relative bg-white p-2 rounded-xl shadow-xs border border-wood/5 overflow-hidden flex flex-col gap-2 transition-all duration-300"
                    >
                      <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-wood/5 relative">
                        <img
                          src={item.src}
                          className="w-full h-full object-cover scale-x-[-1] grayscale-[0.05]"
                          alt={item.label}
                        />

                        {/* Status Label Overlay */}
                        <div className="absolute top-2 left-2">
                          {item.type === 'deleted' ? (
                            <span className="text-[7px] sm:text-[8px] bg-red-500 text-white font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                              <Trash2 className="w-2.5 h-2.5" />
                              Deleted
                            </span>
                          ) : (
                            <span className="text-[7px] sm:text-[8px] bg-amber-500 text-white font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                              <RefreshCw className="w-2.5 h-2.5" />
                              Retaken
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Panel */}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[8px] sm:text-[9px] font-sans font-bold text-wood/40 uppercase tracking-widest">
                          {item.label}
                        </span>
                        <button
                          onClick={() => handleDownloadSingle(item.src, item.type === 'deleted' ? `deleted-${index + 1}` : `retaken-${index + 1}`)}
                          className="p-1 bg-[#FAF0E6] hover:bg-[#F3A0AA]/20 text-[#91545B] hover:text-[#7a4249] rounded-md transition-colors cursor-pointer"
                          title="Download Photo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Start New Session */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-col items-center space-y-3 pb-4"
            >
              <p className="text-[10px] sm:text-xs text-[#725A54] leading-relaxed font-sans text-center">
                Finished saving your photos? Start a fresh session to capture more memories!
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartOver}
                className="w-full max-w-xs py-3 bg-gradient-to-r from-[#91545B] to-[#530F0E] text-white rounded-full font-bold uppercase tracking-widest text-[10px] sm:text-xs shadow-[0_8px_20px_rgba(145,84,91,0.25)] flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                START NEW SESSION
              </motion.button>
            </motion.div>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 sm:bottom-8 z-[60] bg-[#30150E] text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase shadow-xl flex items-center gap-2 border border-white/10"
          >
            <Heart className="w-3.5 h-3.5 fill-[#F3A0AA] text-[#F3A0AA]" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Recap;
