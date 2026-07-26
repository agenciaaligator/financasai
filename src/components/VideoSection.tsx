import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";

// TROCAR: URL do vídeo (embed do YouTube, ex.: https://www.youtube.com/embed/XXXXXXXXXXX)
const VIDEO_URL = "";

export function VideoSection() {
  const { t } = useTranslation();

  return (
    <section id="video" className="container mx-auto px-4 py-16 md:py-20">
      <div className="max-w-4xl mx-auto scroll-reveal">
        <div className="text-center mb-8">
          <div className="section-line mx-auto mb-6" />
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">
            {t('landing.video.title', 'Veja a Dona Wilma em ação')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('landing.video.subtitle', 'Um passeio rápido pelo que ela faz por você todos os dias.')}
          </p>
        </div>

        <div
          className="relative overflow-hidden lift-sm"
          style={{
            borderRadius: "18px",
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 20px 50px -20px rgba(30, 59, 50, 0.30)",
            aspectRatio: "16 / 9",
          }}
        >
          {VIDEO_URL ? (
            <iframe
              src={VIDEO_URL}
              title={t('landing.video.title', 'Veja a Dona Wilma em ação')}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "hsl(var(--pinho))" }}
            >
              <button
                type="button"
                className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center lift-sm"
                style={{ background: "hsl(var(--mel))", color: "hsl(var(--pinho))" }}
                aria-label={t('landing.video.ariaComingSoon', 'Vídeo em breve')}
              >
                <Play className="h-8 w-8 md:h-10 md:w-10 ml-1" strokeWidth={2} fill="currentColor" />
              </button>
              <div
                className="absolute hand text-2xl md:text-3xl"
                style={{
                  bottom: "24px",
                  right: "28px",
                  color: "hsl(var(--mel-soft))",
                  transform: "rotate(-3deg)",
                }}
              >
                {t('landing.video.comingSoon', 'vem ver como eu cuido de você 😊')}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
