export const resources = {
  fr: {
    common: {
      appName: 'CV Genius',
      loading: 'Chargement',
      save: 'Enregistrer',
      delete: 'Supprimer',
      cancel: 'Annuler',
      edit: 'Modifier',
      create: 'Créer',
      export: 'Exporter'
    },
    navigation: {
      app: 'Application',
      pricing: 'Prix',
      dashboard: 'CV',
      profile: 'Profil',
      billing: 'Abonnement',
      sessions: 'Sessions',
      login: 'Connexion',
      register: 'Inscription',
      logout: 'Déconnexion'
    },
    cv: {
      presentation: {
        title: 'Générez un CV clair, ciblé et éditable',
        subtitle: 'CV Genius transforme vos expériences en CV structurés, enrichis par IA et modifiables à tout moment.',
        cta: 'Commencer',
        secondary: 'Voir les tarifs'
      },
      dashboard: {
        title: 'Mes CV',
        subtitle: 'Créez, reprenez et exportez vos CV depuis un espace sécurisé.',
        empty: 'Aucun CV sauvegardé',
        create: 'Créer un CV',
        import: 'Importer un texte',
        open: 'Ouvrir'
      },
      editor: {
        title: 'Éditeur de CV',
        save: 'Sauvegarder',
        aiPolish: 'Améliorer avec l’IA',
        exportJson: 'Exporter JSON',
        exportMarkdown: 'Exporter Markdown'
      },
      pricing: {
        title: 'Des offres centrées sur vos CV',
        free: 'Free',
        premium: 'Premium',
        vip: 'VIP'
      }
    },
    errors: {
      network: 'Erreur réseau',
      unknown: 'Une erreur est survenue',
      forbidden: 'Accès refusé',
      notFound: 'Ressource introuvable'
    }
  },
  en: {
    common: {
      appName: 'CV Genius',
      loading: 'Loading',
      save: 'Save',
      delete: 'Delete',
      cancel: 'Cancel',
      edit: 'Edit',
      create: 'Create',
      export: 'Export'
    },
    navigation: {
      app: 'Application',
      pricing: 'Pricing',
      dashboard: 'Resumes',
      profile: 'Profile',
      billing: 'Billing',
      sessions: 'Sessions',
      login: 'Login',
      register: 'Register',
      logout: 'Logout'
    },
    cv: {
      presentation: {
        title: 'Generate a clear, targeted, editable resume',
        subtitle: 'CV Genius turns your experience into structured resumes, enhanced by AI and editable at any time.',
        cta: 'Start',
        secondary: 'View pricing'
      },
      dashboard: {
        title: 'My resumes',
        subtitle: 'Create, resume and export your resumes from a secure workspace.',
        empty: 'No saved resume',
        create: 'Create resume',
        import: 'Import text',
        open: 'Open'
      },
      editor: {
        title: 'Resume editor',
        save: 'Save',
        aiPolish: 'Improve with AI',
        exportJson: 'Export JSON',
        exportMarkdown: 'Export Markdown'
      },
      pricing: {
        title: 'Plans built around your resumes',
        free: 'Free',
        premium: 'Premium',
        vip: 'VIP'
      }
    },
    errors: {
      network: 'Network error',
      unknown: 'Something went wrong',
      forbidden: 'Access denied',
      notFound: 'Resource not found'
    }
  }
} as const;

export type SupportedLocale = keyof typeof resources;
