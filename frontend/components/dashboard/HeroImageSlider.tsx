"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";

interface HeroSlide {
  image: string;
  alt: string;
  headline: string;
  subtitle: string;
}

const SLIDES: HeroSlide[] = [
  {
    image: "/image1.jpg",
    alt: "Community health workers caring for young children as part of the child nutrition program in Cabadbaran City",
    headline: "Good Nutrition, Healthy Future",
    subtitle: "Monitoring every child's growth to build a well-nourished Cabadbaran City.",
  },
  {
    image: "/image2.jpg",
    alt: "Healthy, smiling children benefiting from the city's nutrition and health programs",
    headline: "Every Child Deserves Better Health",
    subtitle: "Early detection of malnutrition through GIS-integrated health monitoring.",
  },
];

const AUTOPLAY_INTERVAL = 6000;

export function HeroImageSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(((index % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  const goToPrev = useCallback(() => goToSlide(currentIndex - 1), [goToSlide, currentIndex]);
  const goToNext = useCallback(() => goToSlide(currentIndex + 1), [goToSlide, currentIndex]);

  useEffect(() => {
    if (!isAutoPlay) return;
    timerRef.current = setInterval(goToNext, AUTOPLAY_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAutoPlay, goToNext]);

  const toggleAutoPlay = () => setIsAutoPlay((prev) => !prev);
  const pauseAutoPlay = () => setIsAutoPlay(false);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Cabadbaran City health monitoring highlights"
      className="group relative w-full overflow-hidden rounded-2xl shadow-md bg-slate-900"
    >
      {/* Sliding track */}
      <div
        className="flex h-56 sm:h-72 md:h-80 lg:h-96 transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {SLIDES.map((slide) => (
          <div key={slide.image} className="relative h-full w-full shrink-0 overflow-hidden">
            <img
              src={slide.image}
              alt={slide.alt}
              className="h-full w-full object-cover object-center"
            />
            {/* Overlay for text legibility while keeping imagery visible */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/75 via-slate-900/35 to-transparent" />
            <div className="absolute inset-0 flex items-center px-6 sm:px-10 lg:px-14">
              <div className="max-w-xl text-white">
                <h2 className="text-lg sm:text-2xl lg:text-3xl font-black leading-tight drop-shadow">
                  {slide.headline}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-white/85 font-medium drop-shadow">
                  {slide.subtitle}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Previous control */}
      <button
        type="button"
        onClick={() => {
          goToPrev();
          pauseAutoPlay();
        }}
        aria-label="Show previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition-all hover:bg-white/40 focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Next control */}
      <button
        type="button"
        onClick={() => {
          goToNext();
          pauseAutoPlay();
        }}
        aria-label="Show next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition-all hover:bg-white/40 focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Play / Pause control */}
      <button
        type="button"
        onClick={toggleAutoPlay}
        aria-label={isAutoPlay ? "Pause automatic sliding" : "Resume automatic sliding"}
        title={isAutoPlay ? "Pause auto-play" : "Resume auto-play"}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/20 p-1.5 text-white backdrop-blur-md transition-all hover:bg-white/40 focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        {isAutoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      {/* Indicator dots */}
      <div className="absolute bottom-3 left-0 right-0 z-10 flex items-center justify-center gap-2" role="tablist" aria-label="Choose slide">
        {SLIDES.map((slide, idx) => (
          <button
            key={slide.image}
            type="button"
            role="tab"
            aria-selected={idx === currentIndex}
            aria-label={`Go to slide ${idx + 1}: ${slide.headline}`}
            onClick={() => {
              goToSlide(idx);
              pauseAutoPlay();
            }}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex ? "w-7 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}