import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import DriftWall from '../components/DriftWall';

const BG_SOURCES = [1, 2, 3, 4, 5, 6].map((n) => ({
  image: `/bghomepage_${n}.jpeg`,
  title: `Photo ${n}`
}));

// Acak urutan dan duplikasi agar tiap kolom isinya beda-beda
const shuffleItems = (items, count) => {
  const result = [];
  for (let i = 0; i < count; i++) result.push(items[i % items.length]);
  // Fisher-Yates shuffle with seeded-ish deterministic feel per mount
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const Landing = () => {
  const navigate = useNavigate();
  const handleStart = () => navigate('/select-method');

  // 30 items acak (10 kolom × ~3 item per kolom) agar tiap baris beda foto
  const shuffledItems = useMemo(() => shuffleItems(BG_SOURCES, 30), []);

  return (
    <div className="min-h-screen h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-[#F7B993]">
      {/* Drift Wall animation background */}
      <div className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }}>
        <DriftWall
          items={shuffledItems}
          columns={10}
          turn={0}
          tileWidth={150}
          tileHeight={220}
          speed={30}
          fade={0}
          dim={0.3}
          overlayColor="rgba(0, 0, 0, 0.5)"
          parallax={0}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center space-y-4 max-w-xl mx-auto"
      >
        <h1
          className="text-5xl md:text-[64px] font-black text-wood tracking-tight leading-none uppercase font-serif drop-shadow-lg"
          style={{ textShadow: '0 0 32px rgba(248,229,215,0.55), 0 3px 16px rgba(48,21,14,0.35)' }}
        >
          PhotoCoff
        </h1>
        <p className="text-[9px] md:text-[11px] uppercase tracking-[0.4em] text-wood/70 font-sans font-semibold">
          Make a Beautiful Moments with us!
        </p>

        <div className="pt-8">
          <motion.button
            onClick={handleStart}
            whileHover={{ scale: 1.05, backgroundColor: "#FFF0E5" }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-3 bg-silk text-wood rounded-full font-sans text-[10px] md:text-xs font-bold tracking-widest transition-all shadow-xl shadow-black/30"
          >
            GET STARTED
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </div>
      </motion.div>

      {/* Bottom Logo/Icon */}
      <div className="absolute bottom-12 flex flex-col items-center gap-4 opacity-50 z-10">
        <div className="w-8 h-8 border border-wood/40 rounded-full flex items-center justify-center p-1.5">
          <div className="w-full h-full border border-wood/40 rounded-full relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1 h-1 bg-wood/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
