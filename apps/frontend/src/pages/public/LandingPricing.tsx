import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthBootstrap';

const plans = [
  {
    level: 'LEVEL_01',
    name: 'INITIAL',
    price: '00',
    description: 'Transformez une idée en un premier brief structuré.',
    features: ['01 Projet Actif', 'Chatbot Architecte', 'Exports Basiques', 'Génération Plan (limité)'],
    cta: 'INITIALISER'
  },
  {
    level: 'LEVEL_02',
    name: 'ELITE',
    price: '10',
    description: 'Explosez votre productivité avec 5 projets simultanés.',
    features: ['05 Projets Actifs', 'Prompts IA Expert', 'Maquettes & Design', 'Support Prioritaire'],
    cta: 'ACTIVER ELITE',
    recommended: true
  },
  {
    level: 'LEVEL_03',
    name: 'VIP',
    price: '30',
    description: 'Puissance illimitée pour les bâtisseurs intensifs.',
    features: ['Projets Illimités', 'Générations Lourdes (Crédits)', 'Whitelist Nouvelles Fonctions', 'Accès API Direct'],
    cta: 'PASSER VIP'
  }
];

const modules = [
  {
    title: 'ARCHITECTE IA',
    desc: 'Chatbot adaptatif qui clarifie chaque aspect de votre produit, UX et stack.',
    icon: (
      <svg className="size-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )
  },
  {
    title: 'GÉNÉRATEUR DE SPECS',
    desc: 'Roadmaps, specifications, et prompts actionnables générés instantanément.',
    icon: (
      <svg className="size-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    title: 'WORKSPACE EXPORT',
    desc: 'JSON, OpenAPI, Mermaid. Vos plans prêts pour vos agents IA ou dev teams.',
    icon: (
      <svg className="size-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    )
  }
];

function LandingPricing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="space-y-32">
      {/* Hero Section */}
      <section className="relative grid min-h-[70vh] items-center gap-16 lg:grid-cols-2">
        <div className="space-y-8 animate-fadeUp">
          <div className="inline-flex items-center gap-4 px-4 py-2 border-2 border-primary/20 bg-primary/5 font-mono text-[12px] tracking-[0.4em] uppercase text-primary font-black shadow-[0_0_20px_rgba(0,207,141,0.05)]">
            <span className="size-2 bg-primary animate-pulse" />
            VOTRE IDÉE, NOTRE PLAN DE BATAILLE.
          </div>

          <h1 className="text-5xl font-display font-black leading-[0.85] tracking-tighter uppercase sm:text-7xl lg:text-[120px] text-foreground drop-shadow-2xl">
            BÂTIR PLUS <br />
            <span className="text-primary italic">VITE.</span>
          </h1>

          <p className="max-w-xl text-lg sm:text-xl text-foreground font-medium leading-relaxed opacity-90 border-l-4 border-primary/30 pl-6 py-2 bg-foreground/5">
            Transformez vos concepts flous en plans de projet ultra-détaillés. Specs, roadmaps et prompts prêts à l'emploi, générés par IA.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <Button
              size="lg"
              className="group relative overflow-hidden rounded-none bg-primary px-10 h-14 hover:bg-primary/95 transition-all accent-glow"
              onClick={() => navigate(user ? '/dashboard' : '/register')}
            >
              <span className="relative z-10 flex items-center gap-3 font-mono text-sm font-black tracking-[0.2em] text-background">
                {user ? 'ACCESS_SYSTEM' : 'TESTER L\'APPLICATION'}
                <svg className="size-5 group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </Button>


          </div>
        </div>

        {/* 3D Module Panel */}
        <div className="relative perspective-1000 hidden lg:block animate-float">
          <div className="tech-panel relative rotate-y-[-10deg] p-10 xl:p-16 transition-all duration-700 hover:rotate-y-[-2deg] border-foreground/10 group hover:shadow-[0_0_100px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_0_100px_rgba(0,0,0,1)]">


            <div className="space-y-10 xl:space-y-14">
              {modules.map((m) => (
                <div key={m.title} className="group/item relative flex gap-6 xl:gap-8 hover:translate-x-4 transition-all duration-500 cursor-default">
                  <div className="shrink-0 flex size-12 xl:size-14 items-center justify-center rounded-sm bg-foreground/5 border-2 border-foreground/10 group-hover/item:border-primary group-hover/item:bg-primary/10 transition-all text-foreground group-hover/item:text-primary shadow-xl">
                    {m.icon}
                  </div>
                  <div className="space-y-1 xl:space-y-2">
                    <h3 className="font-mono text-xs xl:text-sm font-black tracking-[0.4em] uppercase text-foreground group-hover/item:text-primary transition-colors">{m.title}</h3>
                    <p className="max-w-sm text-[10px] xl:text-xs font-bold leading-relaxed text-foreground opacity-80 group-hover/item:opacity-100 transition-opacity">
                      {m.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Technical grid overlays */}

          </div>

          {/* Decorative bracket */}
          <div className="absolute -top-4 -left-4 size-24 border-t-2 border-l-2 border-primary/30 pointer-events-none" />
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative space-y-24 py-24">
        {/* Background Decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[800px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute top-0 left-0 size-full opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative text-center space-y-4">
          <div className="mx-auto w-px h-12 bg-gradient-to-t from-primary to-transparent" />
          <h2 className="text-3xl font-display font-black tracking-tighter uppercase sm:text-5xl text-foreground">
            PLANS & PUISSANCE <br className="sm:hidden" /> <span className="text-primary italic">DE CALCUL</span>
          </h2>
          <p className="mx-auto max-w-sm text-[12px] font-mono uppercase tracking-[0.5em] text-primary font-black drop-shadow-sm">
            SÉLECTIONNEZ VOTRE NIVEAU D'ARCHITECTE
          </p>
        </div>

        <div className="mx-auto max-w-7xl px-4 grid gap-8 lg:grid-cols-3 perspective-1000">
          {plans.map((plan, idx) => (
            <div
              key={plan.level}
              className={`relative tech-panel p-12 space-y-12 transition-all duration-700 group hover:z-20 md:hover:-translate-y-8 md:hover:rotate-y-[1.5deg] hover:shadow-[0_40px_120px_-20px_rgba(0,0,0,1)] animate-fadeUp ${plan.recommended ? 'border-primary border-2 shadow-[0_0_80px_-10px_rgba(161,100,41,0.5)]' : 'border-white/20'
                }`}
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              {plan.recommended && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-primary px-10 py-2.5 font-mono text-[11px] font-black text-primary-foreground tracking-[0.5em] uppercase shadow-2xl shadow-primary/40 rounded-b-sm">
                  RECOMMENDED_CORE
                </div>
              )}



              <div className="space-y-8 pt-4">
                <div className="flex items-center gap-4">
                  <div className={`size-2.5 shrink-0 ${plan.recommended ? 'bg-primary shadow-[0_0_10px_rgba(161,100,41,0.8)]' : 'bg-primary/60'}`} />
                  <div className="font-mono text-sm font-black tracking-[0.4em] text-foreground uppercase border-b-2 border-primary pb-2 w-full">
                    {plan.name} // ARCHITECT
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-baseline gap-2 sm:gap-4">
                    <span className="text-7xl sm:text-[100px] font-display font-black leading-none tracking-tighter text-foreground drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                      {plan.price}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs sm:text-sm font-black tracking-widest text-primary uppercase">EUR</span>
                      <span className="font-mono text-[10px] sm:text-xs tracking-[0.2em] text-foreground font-black uppercase">/ MOIS</span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-black leading-relaxed text-foreground uppercase tracking-widest border-l-4 border-primary pl-4 py-1 italic bg-foreground/5">
                    {plan.description}
                  </p>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-border/50 to-transparent" />

              <ul className="space-y-7 font-mono text-[12px] tracking-widest font-black">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-5 group/item">
                    <span className="mt-1 flex size-2.5 shrink-0 items-center justify-center border-2 border-primary bg-primary/20 shadow-[0_0_10px_rgba(161,100,41,0.3)]">
                      <span className={`size-1.5 ${f.includes('limité') || f.includes('Crédits') ? 'bg-foreground/20' : 'bg-primary'} animate-pulse`} />
                    </span>
                    <span className={`transition-colors duration-300 ${f.includes('limité') ? 'text-foreground/40' : 'text-foreground group-hover/item:text-primary underline-offset-4 decoration-primary/50'}`}>
                      {f.toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <Button
                  variant={plan.recommended ? 'primary' : 'outline'}
                  className={`w-full relative overflow-hidden rounded-none font-mono text-[10px] font-black tracking-[0.3em] h-14 uppercase transition-all duration-500 ${plan.recommended
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground accent-glow border-none scale-105'
                    : 'border-foreground/20 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all'
                    }`}
                  onClick={() => navigate(user ? '/billing' : '/register')}
                >
                  <span className="relative z-10">{plan.cta}</span>
                  {plan.recommended && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  )}
                </Button>
              </div>

              <div className="flex justify-between items-center opacity-20 group-hover:opacity-40 transition-opacity">
                <div className="h-[2px] w-full bg-border" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default LandingPricing;
