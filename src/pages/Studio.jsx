import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ArrowRight, Trash2, Aperture } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePhotography } from '../context/PhotographyContext';

const Studio = () => {
  const navigate = useNavigate();
  const { method, photoCount, setPhotos: setContextPhotos, addDeletedPhoto, addRetakenPhoto, setLiveClips } = usePhotography();
  const [photos, setPhotos] = useState([]);
  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const clipChunksRef = useRef([]);
  const liveClipsRef = useRef([]); // 1:1 dengan photos berdasarkan index
  const recordingTimeoutRef = useRef(null);
  const drawFrameRef = useRef(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { aspectRatio: 4 / 3, width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30, max: 60 } }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  useEffect(() => {
    if (!method) {
      navigate('/select-method');
      return;
    }

    if (method === 'camera') {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, [method, navigate]);

  const isRecorderActive = () => recorderRef.current && recorderRef.current.state !== 'inactive';

  const REC_W = 640, REC_H = 480;

  // Rekam dari canvas kecil 640x480 @30fps (bukan stream kamera mentah) supaya
  // video live yang dihasilkan ringan decode & halus saat diputar.
  const startRecording = () => {
    if (!streamRef.current) return;
    if (isRecorderActive()) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = REC_W;
    canvas.height = REC_H;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      // Berhenti menggambar begitu perekam tidak aktif lagi
      if (!isRecorderActive()) return;
      ctx.save();
      ctx.translate(REC_W, 0);
      ctx.scale(-1, 1); // cerminkan agar sama dengan tampilan take-photo
      ctx.drawImage(video, 0, 0, REC_W, REC_H);
      ctx.restore();
      drawFrameRef.current = requestAnimationFrame(draw);
    };
    drawFrameRef.current = requestAnimationFrame(draw);

    try {
      const stream = canvas.captureStream(30);
      const mimeType = ['video/webm;codecs=vp8', 'video/webm']
        .find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 5000000,
      });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) clipChunksRef.current.push(e.data); };
      recorderRef.current = recorder;
      recorder.start();
    } catch { /* MediaRecorder not supported, skip */ }
  };

  // Selesaikan rekaman aktif dan simpan clip-nya ke liveClipsRef
  const stopActiveRecording = async () => {
    const recorder = recorderRef.current;
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (drawFrameRef.current) {
      cancelAnimationFrame(drawFrameRef.current);
      drawFrameRef.current = null;
    }
    if (!recorder || recorder.state === 'inactive') {
      recorderRef.current = null;
      return;
    }
    await new Promise((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    recorderRef.current = null;
    if (clipChunksRef.current.length > 0) {
      const clipUrl = URL.createObjectURL(new Blob(clipChunksRef.current, { type: 'video/webm' }));
      liveClipsRef.current = [...liveClipsRef.current, clipUrl];
      clipChunksRef.current = [];
    }
    setIsRecordingClip(false);
  };

  // Buang rekaman aktif (dipakai saat foto terakhir dihapus/retake)
  const discardActiveRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (drawFrameRef.current) {
      cancelAnimationFrame(drawFrameRef.current);
      drawFrameRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    clipChunksRef.current = [];
    setIsRecordingClip(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg');
  };

  const triggerCapture = () => {
    const photoData = capturePhoto();
    if (!photoData) return;
    setPhotos(prev => {
      if (prev.length >= photoCount) return prev;
      return [...prev, photoData];
    });
  };

  const startCountdown = async () => {
    if (photos.length >= photoCount || countdown !== null) return;

    // Tutup clip foto sebelumnya dulu, supaya tiap foto punya clip sendiri (1:1)
    await stopActiveRecording();

    // Mulai rekaman: mencakup momen SEBELUM foto diambil
    startRecording();
    setIsRecordingClip(true);

    let count = 1;
    setCountdown(count);

    timerRef.current = setInterval(() => {
      count += 1;
      if (count <= 3) {
        setCountdown(count);
      } else {
        clearInterval(timerRef.current);
        setCountdown(null);
        // Foto diambil di tengah rekaman
        triggerCapture();
      }
    }, 1000);

    const myRecorder = recorderRef.current;

    // Batas maksimal clip: berhenti 10 detik setelah mulai (momen SESUDAH foto terambil).
    // Guard identitas: hanya menghentikan clip milik foto ini, bukan clip foto berikutnya.
    recordingTimeoutRef.current = setTimeout(() => {
      if (recorderRef.current === myRecorder) {
        stopActiveRecording();
      }
    }, 10000);
  };

  const deletePhoto = (indexToDelete) => {
    const deletedPhotoData = photos[indexToDelete];
    if (deletedPhotoData) {
      addDeletedPhoto(deletedPhotoData);
    }

    if (indexToDelete === photos.length - 1) {
      // Foto terakhir: clip yang sedang/baru direkam miliknya, buang rekaman aktif.
      // liveClipsRef belum berisi clip aktif, jadi tidak perlu dipotong.
      discardActiveRecording();
    } else {
      // Foto di tengah/awal: buang clip pada index yang sama agar tetap 1:1.
      liveClipsRef.current = liveClipsRef.current.filter((_, i) => i !== indexToDelete);
    }

    setPhotos(photos.filter((_, index) => index !== indexToDelete));
  };

  const retakeLast = () => {
    if (photos.length === 0) return;
    const lastPhoto = photos[photos.length - 1];
    if (lastPhoto) {
      addRetakenPhoto(lastPhoto);
    }
    setPhotos(photos.slice(0, -1));
    if (isRecorderActive()) {
      // Clip untuk foto terakhir masih direkam, buang saja
      discardActiveRecording();
    } else {
      liveClipsRef.current = liveClipsRef.current.slice(0, -1);
    }
  };

  const handleNext = async () => {
    // Pastikan clip foto terakhir sudah selesai & masuk daftar sebelum pindah halaman
    await stopActiveRecording();
    setContextPhotos(photos);
    setLiveClips(liveClipsRef.current);
    navigate('/select-frame');
  };

  return (
    <div className="h-screen overflow-hidden w-screen bg-silk flex flex-col items-center py-2 sm:py-4 md:py-8 font-sans relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-40 mix-blend-overlay z-0"
        style={{ backgroundImage: "url('/bg_landingpage.png')" }}
      />

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <main className="relative z-10 flex flex-col md:flex-row items-center md:items-center justify-between w-full max-w-[1100px] px-3 sm:px-4 md:px-8 flex-1 min-h-0 gap-3 sm:gap-4 md:gap-6">
        <div className="flex flex-col flex-1 min-w-0 w-full md:max-w-[660px] min-h-0 justify-center">
          <div className="relative w-full aspect-[4/3] max-h-[35vh] sm:max-h-[45vh] md:max-h-[70vh] bg-[#111] rounded-[14px] sm:rounded-[20px] overflow-hidden shadow-2xl ring-1 ring-wood/10 mx-auto animate-fadeIn">
            <div className="absolute inset-4 sm:inset-8 border border-white/10 pointer-events-none rounded-md z-10" />
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="w-8 h-8 sm:w-10 sm:h-10 relative">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/30" />
                <div className="absolute left-1/2 top-0 w-[1px] h-full bg-white/30" />
              </div>
            </div>

            {method === 'camera' && (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
            )}
          </div>

          <div className="flex flex-col items-center mt-3 sm:mt-6 relative w-full">
            <div className="h-8 sm:h-10 flex items-center justify-center mb-1 sm:mb-2">
              <AnimatePresence mode="wait">
                {countdown !== null && (
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.8, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 1.1, opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="bg-[#530F0E] text-[#FDFBF9] px-4 sm:px-5 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-[0.2em] uppercase font-sans flex items-center gap-2 sm:gap-2.5 shadow-lg border border-[#FDFBF9]/10"
                  >
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500 animate-ping" />
                    POSE IN {countdown}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center relative w-full h-[60px] sm:h-[80px]">
              <button
                onClick={retakeLast}
                disabled={photos.length === 0 || countdown !== null}
                className="absolute left-2 sm:left-6 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold text-wood/40 hover:text-wood disabled:opacity-0 transition-all cursor-pointer font-sans"
              >
                RETAKE
              </button>

              <motion.button
                whileHover={{ scale: (photos.length >= photoCount || countdown !== null) ? 1 : 1.05 }}
                whileTap={{ scale: (photos.length >= photoCount || countdown !== null) ? 1 : 0.9 }}
                onClick={startCountdown}
                disabled={photos.length >= photoCount || countdown !== null}
                className="mx-auto w-[56px] h-[56px] sm:w-[80px] sm:h-[80px] rounded-full flex items-center justify-center bg-[#30150E] shadow-[0_15px_30px_rgba(48,21,14,0.2)] z-10 disabled:opacity-50 cursor-pointer"
              >
                <Aperture className={`w-7 h-7 sm:w-10 sm:h-10 text-white stroke-[1.5] ${countdown !== null ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[33%] md:max-w-[340px] bg-white rounded-[16px] sm:rounded-[24px] p-3 sm:p-6 flex flex-col shadow-[0_20px_50px_rgba(48,21,14,0.03)] border border-wood/5 md:h-full min-h-0 max-h-[30vh] md:max-h-none">
          <div className="flex items-center justify-between pb-2 sm:pb-4 border-b border-wood/10 mb-2 sm:mb-4 flex-shrink-0">
            <h2 className="text-[10px] sm:text-[11px] font-bold text-wood uppercase tracking-[0.2em] font-sans">CAPTURED</h2>
            <span className="text-[11px] sm:text-[13px] italic font-serif text-wood/70">{photos.length} of {photoCount}</span>
          </div>

          <div className="flex md:hidden gap-2 overflow-x-auto flex-1 min-h-0 pb-1">
            {[...Array(photoCount)].map((_, i) => (
              <div key={i} className={`group flex-shrink-0 w-[68px] h-[68px] rounded-[10px] relative overflow-hidden transition-all ${photos[i] ? 'shadow-md ring-1 ring-wood/10' : 'bg-[#FFF9F6] border-2 border-dashed border-[#F3A0AA]/40'} flex items-center justify-center`}>
                {photos[i] ? (
                  <>
                    <img src={photos[i]} className="w-full h-full object-contain bg-[#FFF9F6] absolute inset-0" alt={`Captured ${i + 1}`} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 active:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => deletePhoto(i)}
                        className="p-1.5 bg-white/20 hover:bg-[#91545B] rounded-full backdrop-blur-md text-white transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 opacity-60 p-1">
                    <Camera className="w-3 h-3 text-[#91545B]/60" strokeWidth={1.5} />
                    <span className="text-[6px] uppercase tracking-[0.1em] font-bold font-sans text-[#91545B]/60">
                      EMPTY
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={`hidden md:grid gap-3 flex-1 min-h-0 ${photoCount === 4 ? 'grid-cols-2 grid-rows-2 place-items-center' : 'grid-cols-1'}`}>
            {[...Array(photoCount)].map((_, i) => (
              <div key={i} className={`group min-h-0 w-full rounded-[16px] relative overflow-hidden transition-all ${photoCount === 4 ? 'aspect-square h-full max-h-full max-w-full' : ''} ${photos[i] ? 'shadow-md ring-1 ring-wood/10' : 'bg-[#FFF9F6] border-2 border-dashed border-[#F3A0AA]/40'} flex items-center justify-center`}>
                {photos[i] ? (
                  <>
                    <img src={photos[i]} className={`absolute inset-0 ${photoCount === 4 ? 'w-full h-full object-contain bg-[#FFF9F6]' : 'w-full h-full object-cover'}`} alt={`Captured ${i + 1}`} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => deletePhoto(i)}
                        className="p-3 bg-white/20 hover:bg-[#91545B] rounded-full backdrop-blur-md text-white transition-all transform hover:scale-110 active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 opacity-60 p-2">
                    <Camera className={`${photoCount === 4 ? 'w-4 h-4' : 'w-5 h-5'} text-[#91545B]/60`} strokeWidth={1.5} />
                    <span className={`${photoCount === 4 ? 'text-[7px]' : 'text-[9px]'} uppercase tracking-[0.15em] font-bold font-sans text-[#91545B]/60 text-center`}>
                      {photoCount === 4 ? 'EMPTY' : 'EMPTY FRAME'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <motion.button
            disabled={photos.length === 0}
            onClick={handleNext}
            className={`mt-3 sm:mt-6 w-full py-2.5 sm:py-3.5 rounded-xl flex items-center justify-center gap-2 font-sans text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] transition-all flex-shrink-0 cursor-pointer ${photos.length > 0 ? 'bg-[#91545B] text-white hover:bg-[#7a4249] shadow-[0_10px_20px_rgba(145,84,91,0.2)]' : 'bg-wood/5 text-wood/30 cursor-not-allowed'}`}
          >
            NEXT STEP
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1" />
          </motion.button>
        </div>
      </main>
    </div>
  );
};

export default Studio;
