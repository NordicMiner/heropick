// Every word the app shows. Plain words, short sentences.
export const COPY = {
  appName: 'HeroPick',
  home: { quick: 'Quick pick', lightroom: 'Lightroom — coming soon', settings: 'Settings' },
  profile: { title: 'What did you shoot?', choose: 'Choose photos' },
  progress: (done: number, total: number) => `Checking photos… ${done} of ${total}`,
  noFaces: "Faces couldn't be checked. Picks are based on sharpness and light.",
  skipped: (k: number) => (k === 1 ? "1 photo couldn't be read" : `${k} photos couldn't be read`),
  set: {
    title: (n: number) => `Your best ${n}`,
    fewer: 'Fewer', more: 'More', swap: 'Swap', edit: 'Edit', share: 'Share', startNew: 'Start new', back: 'Back',
    preparing: 'Getting photos ready…',
    send: (n: number) => (n === 1 ? 'Send 1 photo' : `Send ${n} photos`),
    shareNext: (k: number, n: number) => `Share next (${k} of ${n})`,
    sent: 'Sent',
  },
  person: { main: 'Main person', none: 'No main person found', change: 'Change', title: 'Who is the main person?', pickAgain: 'Pick photos again to change' },
  edit: { brightness: 'Brightness', contrast: 'Contrast', look: 'Look', none: 'None', strength: 'Strength', applyAll: 'Apply to all', justThis: 'Just this one' },
  settings: {
    title: 'Settings', looks: 'Looks', addLook: 'Add a look (.cube)', remove: 'Remove', exportSize: 'Export size',
    chat: 'Chat size (2048)', full: 'Full size', offlineReady: 'Offline ready', notReady: 'Not ready offline — open once with signal',
  },
  errors: {
    generic: 'Something went wrong. Try again.',
    save: "Couldn't save your picks on this phone. Share before you leave HeroPick.",
  },
} as const;
