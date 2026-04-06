import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';

// ============================================================================
// INDEXEDDB PERSISTENCE HOOK
// Uses IndexedDB instead of localStorage — handles 26k+ rows without quota issues
// IndexedDB is a W3C standard built into every modern browser (Chrome, Firefox, Safari, Edge)
// ============================================================================

const DB_NAME = 'ps_commerce_planner';
const DB_VERSION = 1;
const STORE_NAME = 'state';

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const idbGet = async (key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const idbSet = async (key, value) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const usePersistedState = (key, initialValue) => {
  const [state, setState] = useState(initialValue);
  const initialized = useRef(false);

  // Load from IndexedDB on mount (also migrate from old localStorage if present)
  useEffect(() => {
    (async () => {
      try {
        // First check IndexedDB
        const stored = await idbGet(key);
        if (stored !== undefined) {
          setState(stored);
          initialized.current = true;
          return;
        }
        // Migrate from old localStorage if it exists
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          setState(parsed);
          await idbSet(key, parsed);
          localStorage.removeItem(key); // clean up old storage
          initialized.current = true;
          return;
        }
      } catch (e) { /* use default */ }
      initialized.current = true;
    })();
  }, [key]);

  // Save to IndexedDB whenever state changes (skip initial load)
  useEffect(() => {
    if (!initialized.current) return;
    idbSet(key, state).catch(() => { /* ignore write errors */ });
  }, [key, state]);

  return [state, setState];
};

// ============================================================================
// COMMERCE CATEGORY SEASONAL MODEL
// Demand intensity 1-10 by month (0=Jan, 11=Dec)
// Built from PopSci commerce vertical analysis
// ============================================================================

const SEASONAL_MODEL = {
  // POWER TOOLS
  "Cordless Power Tools": {
    keywords: ["milwaukee", "dewalt", "makita", "ryobi", "cordless drill", "impact driver", "power tool deals"],
    vertical: "Power Tools",
    seasonal: { 0: 4, 1: 4, 2: 6, 3: 8, 4: 9, 5: 8, 6: 7, 7: 6, 8: 6, 9: 7, 10: 9, 11: 10 },
    avgAOV: 120, avgCommRate: 0.04
  },
  "Benchtop & Workshop Tools": {
    keywords: ["table saw", "drill press", "miter saw", "workshop", "bench grinder", "woodworking"],
    vertical: "Power Tools",
    seasonal: { 0: 5, 1: 5, 2: 6, 3: 7, 4: 7, 5: 6, 6: 5, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9 },
    avgAOV: 250, avgCommRate: 0.04
  },

  // OUTDOOR & YARD
  "Battery Yard Tools": {
    keywords: ["ego", "greenworks", "lawn mower", "leaf blower", "string trimmer", "battery yard", "yard tool deals"],
    vertical: "Outdoor & Yard",
    seasonal: { 0: 2, 1: 3, 2: 6, 3: 9, 4: 10, 5: 9, 6: 7, 7: 6, 8: 5, 9: 4, 10: 2, 11: 2 },
    avgAOV: 300, avgCommRate: 0.03
  },
  "Grills & Outdoor Cooking": {
    keywords: ["grill", "smoker", "flat top", "pizza oven", "outdoor cooking", "bbq", "pellet grill"],
    vertical: "Outdoor & Yard",
    seasonal: { 0: 2, 1: 3, 2: 5, 3: 7, 4: 9, 5: 10, 6: 10, 7: 9, 8: 7, 9: 5, 10: 3, 11: 3 },
    avgAOV: 400, avgCommRate: 0.05
  },
  "Patio & Outdoor Furniture": {
    keywords: ["patio furniture", "outdoor furniture", "adirondack", "hammock", "fire pit"],
    vertical: "Outdoor & Yard",
    seasonal: { 0: 2, 1: 2, 2: 5, 3: 8, 4: 10, 5: 9, 6: 8, 7: 7, 8: 5, 9: 3, 10: 2, 11: 2 },
    avgAOV: 350, avgCommRate: 0.04
  },

  // AUDIO
  "Noise-Canceling Headphones": {
    keywords: ["noise cancelling", "anc headphones", "sony wh", "airpods max", "bose", "headphone deals"],
    vertical: "Audio",
    seasonal: { 0: 5, 1: 4, 2: 5, 3: 5, 4: 5, 5: 6, 6: 7, 7: 7, 8: 6, 9: 7, 10: 9, 11: 10 },
    avgAOV: 250, avgCommRate: 0.04
  },
  "Wireless Earbuds": {
    keywords: ["airpods", "earbuds", "wireless earbuds", "true wireless", "galaxy buds", "linkbuds"],
    vertical: "Audio",
    seasonal: { 0: 5, 1: 4, 2: 5, 3: 5, 4: 6, 5: 6, 6: 7, 7: 7, 8: 7, 9: 7, 10: 9, 11: 10 },
    avgAOV: 150, avgCommRate: 0.04
  },
  "Bluetooth Speakers": {
    keywords: ["jbl", "bluetooth speaker", "party speaker", "portable speaker", "soundboks", "outdoor speaker"],
    vertical: "Audio",
    seasonal: { 0: 3, 1: 3, 2: 4, 3: 5, 4: 7, 5: 9, 6: 10, 7: 9, 8: 7, 9: 5, 10: 6, 11: 8 },
    avgAOV: 120, avgCommRate: 0.05
  },
  "Home Audio & Hi-Fi": {
    keywords: ["turntable", "bookshelf speaker", "surround sound", "denon", "klipsch", "audiophile", "dac", "amp"],
    vertical: "Audio",
    seasonal: { 0: 5, 1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 6, 10: 8, 11: 10 },
    avgAOV: 300, avgCommRate: 0.04
  },
  "IEMs & Audiophile": {
    keywords: ["iem", "in-ear monitor", "meze", "sennheiser", "dap", "lossless", "audiophile earbuds"],
    vertical: "Audio",
    seasonal: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 6, 10: 8, 11: 9 },
    avgAOV: 200, avgCommRate: 0.05
  },

  // SOLAR & POWER
  "Portable Power Stations": {
    keywords: ["ecoflow", "bluetti", "jackery", "portable power station", "solar generator", "power station deals"],
    vertical: "Solar & Power",
    seasonal: { 0: 4, 1: 4, 2: 5, 3: 6, 4: 7, 5: 9, 6: 10, 7: 9, 8: 8, 9: 6, 10: 5, 11: 6 },
    avgAOV: 500, avgCommRate: 0.05
  },
  "Solar Panels & Generators": {
    keywords: ["solar panel", "solar generator", "home solar", "portable solar", "solar power bank"],
    vertical: "Solar & Power",
    seasonal: { 0: 3, 1: 3, 2: 5, 3: 6, 4: 8, 5: 9, 6: 10, 7: 9, 8: 7, 9: 5, 10: 4, 11: 3 },
    avgAOV: 400, avgCommRate: 0.05
  },
  "Home Generators & Backup": {
    keywords: ["home generator", "whole house generator", "backup power", "standby generator", "wind turbine"],
    vertical: "Solar & Power",
    seasonal: { 0: 5, 1: 4, 2: 4, 3: 5, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 7, 10: 5, 11: 5 },
    avgAOV: 600, avgCommRate: 0.04
  },

  // APPLE & TECH
  "Apple Wearables": {
    keywords: ["apple watch", "airpods", "airpods pro", "apple watch ultra"],
    vertical: "Apple & Tech",
    seasonal: { 0: 5, 1: 4, 2: 4, 3: 5, 4: 5, 5: 5, 6: 6, 7: 6, 8: 8, 9: 9, 10: 9, 11: 10 },
    avgAOV: 300, avgCommRate: 0.03
  },
  "MacBooks & iPads": {
    keywords: ["macbook", "ipad", "macbook pro", "macbook air", "ipad pro", "m5", "apple laptop"],
    vertical: "Apple & Tech",
    seasonal: { 0: 5, 1: 4, 2: 4, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 8, 10: 8, 11: 10 },
    avgAOV: 1200, avgCommRate: 0.02
  },

  // MONITORS & DISPLAYS
  "Monitors": {
    keywords: ["monitor", "4k monitor", "ultrawide", "gaming monitor", "monitor deals", "monitor stand"],
    vertical: "Monitors & Displays",
    seasonal: { 0: 6, 1: 5, 2: 5, 3: 5, 4: 5, 5: 6, 6: 7, 7: 8, 8: 8, 9: 7, 10: 8, 11: 9 },
    avgAOV: 350, avgCommRate: 0.03
  },
  "TVs": {
    keywords: ["tv", "oled", "qled", "mini led", "samsung tv", "hisense", "tcl", "sony bravia"],
    vertical: "Monitors & Displays",
    seasonal: { 0: 6, 1: 7, 2: 5, 3: 5, 4: 5, 5: 5, 6: 6, 7: 6, 8: 6, 9: 7, 10: 9, 11: 10 },
    avgAOV: 800, avgCommRate: 0.03
  },

  // SMART HOME
  "Robot Vacuums": {
    keywords: ["robot vacuum", "roomba", "ecovacs", "roborock", "shark robot"],
    vertical: "Smart Home",
    seasonal: { 0: 5, 1: 4, 2: 5, 3: 6, 4: 6, 5: 6, 6: 7, 7: 6, 8: 5, 9: 7, 10: 9, 11: 10 },
    avgAOV: 350, avgCommRate: 0.04
  },
  "Wi-Fi & Networking": {
    keywords: ["wifi router", "mesh wifi", "eero", "wifi extender", "networking"],
    vertical: "Smart Home",
    seasonal: { 0: 6, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 6, 7: 7, 8: 8, 9: 6, 10: 8, 11: 9 },
    avgAOV: 200, avgCommRate: 0.04
  },
  "Smart Home Security": {
    keywords: ["security camera", "video doorbell", "smart lock", "wired camera", "home security"],
    vertical: "Smart Home",
    seasonal: { 0: 5, 1: 5, 2: 5, 3: 6, 4: 6, 5: 7, 6: 7, 7: 7, 8: 6, 9: 7, 10: 8, 11: 9 },
    avgAOV: 150, avgCommRate: 0.04
  },

  // HOME & KITCHEN
  "Kitchen Appliances": {
    keywords: ["kitchenaid", "ninja", "instant pot", "air fryer", "stand mixer", "espresso machine", "delonghi"],
    vertical: "Home & Kitchen",
    seasonal: { 0: 5, 1: 4, 2: 4, 3: 5, 4: 6, 5: 6, 6: 5, 7: 5, 8: 5, 9: 6, 10: 9, 11: 10 },
    avgAOV: 200, avgCommRate: 0.04
  },
  "Vacuums & Cleaning": {
    keywords: ["dyson", "vacuum", "shark vacuum", "cordless vacuum", "air purifier", "vacuum deals"],
    vertical: "Home & Kitchen",
    seasonal: { 0: 5, 1: 4, 2: 6, 3: 7, 4: 7, 5: 6, 6: 5, 7: 5, 8: 5, 9: 6, 10: 8, 11: 9 },
    avgAOV: 300, avgCommRate: 0.04
  },
  "Water Filtration": {
    keywords: ["water filter", "reverse osmosis", "water purifier", "water flosser", "water pick"],
    vertical: "Home & Kitchen",
    seasonal: { 0: 5, 1: 5, 2: 6, 3: 7, 4: 7, 5: 7, 6: 7, 7: 6, 8: 5, 9: 5, 10: 5, 11: 6 },
    avgAOV: 150, avgCommRate: 0.05
  },

  // E-BIKES & MOBILITY
  "Electric Bikes": {
    keywords: ["electric bike", "ebike", "e-bike", "commuter bike", "fat tire", "folding ebike", "super73"],
    vertical: "E-Bikes & Mobility",
    seasonal: { 0: 2, 1: 3, 2: 5, 3: 7, 4: 9, 5: 10, 6: 9, 7: 8, 8: 7, 9: 5, 10: 3, 11: 3 },
    avgAOV: 1200, avgCommRate: 0.05
  },
  "E-Scooters & Alt Transport": {
    keywords: ["electric scooter", "e-scooter", "electric skateboard", "onewheel"],
    vertical: "E-Bikes & Mobility",
    seasonal: { 0: 2, 1: 3, 2: 5, 3: 7, 4: 9, 5: 10, 6: 9, 7: 8, 8: 6, 9: 4, 10: 3, 11: 3 },
    avgAOV: 500, avgCommRate: 0.04
  },

  // HEALTH & WELLNESS
  "Home Fitness": {
    keywords: ["home gym", "treadmill", "exercise bike", "rower", "fitness tracker", "sauna", "massage gun"],
    vertical: "Health & Wellness",
    seasonal: { 0: 10, 1: 9, 2: 7, 3: 6, 4: 5, 5: 5, 6: 4, 7: 4, 8: 5, 9: 6, 10: 6, 11: 7 },
    avgAOV: 300, avgCommRate: 0.04
  },
  "Personal Care Tech": {
    keywords: ["electric toothbrush", "hair dryer", "airwrap", "high frequency wand", "grooming"],
    vertical: "Health & Wellness",
    seasonal: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 6, 5: 6, 6: 5, 7: 5, 8: 5, 9: 6, 10: 8, 11: 10 },
    avgAOV: 100, avgCommRate: 0.04
  },

  // 3D PRINTING & MAKER
  "3D Printers": {
    keywords: ["3d printer", "bambu", "ender", "resin printer", "filament"],
    vertical: "3D Printing & Maker",
    seasonal: { 0: 6, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 6, 9: 6, 10: 8, 11: 10 },
    avgAOV: 400, avgCommRate: 0.04
  },

  // GAMING
  "Gaming Deals": {
    keywords: ["xbox", "ps5", "switch", "game pass", "gaming deals", "video game"],
    vertical: "Gaming",
    seasonal: { 0: 5, 1: 4, 2: 4, 3: 4, 4: 5, 5: 6, 6: 7, 7: 6, 8: 5, 9: 6, 10: 9, 11: 10 },
    avgAOV: 50, avgCommRate: 0.02
  },

  // PROJECTORS & HOME THEATER
  "Projectors": {
    keywords: ["projector", "4k projector", "portable projector", "home theater", "laser projector"],
    vertical: "Home Theater",
    seasonal: { 0: 4, 1: 4, 2: 4, 3: 5, 4: 5, 5: 6, 6: 7, 7: 7, 8: 6, 9: 6, 10: 8, 11: 9 },
    avgAOV: 500, avgCommRate: 0.04
  },

  // GOLF & OUTDOOR SPORT
  "Golf Gear": {
    keywords: ["golf", "putter", "driver", "golf club", "rangefinder", "golf deals"],
    vertical: "Outdoor Sports",
    seasonal: { 0: 2, 1: 3, 2: 6, 3: 8, 4: 10, 5: 9, 6: 8, 7: 7, 8: 6, 9: 5, 10: 3, 11: 3 },
    avgAOV: 200, avgCommRate: 0.04
  },
  "Running & Athletic": {
    keywords: ["running shoe", "hoka", "brooks", "on cloud", "trail running", "running gear"],
    vertical: "Outdoor Sports",
    seasonal: { 0: 7, 1: 6, 2: 7, 3: 8, 4: 9, 5: 8, 6: 7, 7: 7, 8: 8, 9: 9, 10: 6, 11: 5 },
    avgAOV: 140, avgCommRate: 0.05
  },

  // OFFICE & FURNITURE
  "Office Chairs & Ergonomics": {
    keywords: ["office chair", "ergonomic chair", "standing desk", "seat cushion", "kneeling chair", "desk pad"],
    vertical: "Office & Furniture",
    seasonal: { 0: 8, 1: 7, 2: 6, 3: 6, 4: 6, 5: 5, 6: 5, 7: 6, 8: 8, 9: 7, 10: 7, 11: 8 },
    avgAOV: 300, avgCommRate: 0.04
  },
  "Recliners & Home Seating": {
    keywords: ["recliner", "power lift recliner", "swivel recliner", "massage chair"],
    vertical: "Office & Furniture",
    seasonal: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 6, 10: 8, 11: 9 },
    avgAOV: 500, avgCommRate: 0.04
  },

  // AUTO & VEHICLE
  "Dash Cams & Car Tech": {
    keywords: ["dash cam", "car camera", "dashcam", "head unit", "car accessories"],
    vertical: "Auto & Vehicle",
    seasonal: { 0: 5, 1: 5, 2: 5, 3: 6, 4: 6, 5: 7, 6: 7, 7: 7, 8: 6, 9: 6, 10: 8, 11: 9 },
    avgAOV: 120, avgCommRate: 0.04
  },
  "Jump Starters & Roadside": {
    keywords: ["jump starter", "portable jump starter", "emergency kit", "roadside kit", "air compressor"],
    vertical: "Auto & Vehicle",
    seasonal: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 6, 6: 6, 7: 6, 8: 5, 9: 5, 10: 7, 11: 9 },
    avgAOV: 80, avgCommRate: 0.05
  },
  "Garage & Home Maintenance": {
    keywords: ["garage door opener", "garage heater", "motion sensor light", "attic antenna"],
    vertical: "Auto & Vehicle",
    seasonal: { 0: 5, 1: 5, 2: 6, 3: 7, 4: 8, 5: 8, 6: 7, 7: 7, 8: 7, 9: 7, 10: 6, 11: 6 },
    avgAOV: 200, avgCommRate: 0.04
  },

  // HOBBY & MAKER
  "Drones": {
    keywords: ["drone", "dji", "camera drone", "fpv drone"],
    vertical: "3D Printing & Maker",
    seasonal: { 0: 5, 1: 4, 2: 5, 3: 6, 4: 7, 5: 7, 6: 7, 7: 7, 8: 6, 9: 6, 10: 8, 11: 10 },
    avgAOV: 400, avgCommRate: 0.03
  },
  "Science & Education": {
    keywords: ["telescope", "microscope", "metal detector", "arduino", "lego", "marble run"],
    vertical: "3D Printing & Maker",
    seasonal: { 0: 5, 1: 4, 2: 4, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 6, 9: 6, 10: 8, 11: 10 },
    avgAOV: 100, avgCommRate: 0.04
  },

  // HOME CLIMATE
  "Dehumidifiers & Air Quality": {
    keywords: ["dehumidifier", "air quality monitor", "crawl space", "mold"],
    vertical: "Home & Kitchen",
    seasonal: { 0: 3, 1: 3, 2: 5, 3: 7, 4: 8, 5: 9, 6: 9, 7: 8, 8: 7, 9: 5, 10: 3, 11: 3 },
    avgAOV: 200, avgCommRate: 0.04
  },
  "Water Heaters & Plumbing": {
    keywords: ["tankless water heater", "water heater", "whole house filter"],
    vertical: "Home & Kitchen",
    seasonal: { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6, 5: 5, 6: 5, 7: 5, 8: 6, 9: 7, 10: 7, 11: 7 },
    avgAOV: 400, avgCommRate: 0.04
  },
  "Outdoor Cooling & Fans": {
    keywords: ["misting fan", "outdoor fan", "portable fan", "desk fan"],
    vertical: "Home & Kitchen",
    seasonal: { 0: 1, 1: 2, 2: 3, 3: 5, 4: 7, 5: 9, 6: 10, 7: 10, 8: 7, 9: 4, 10: 2, 11: 1 },
    avgAOV: 80, avgCommRate: 0.05
  },

  // CAMERAS & PRINTERS
  "Cameras & Photography": {
    keywords: ["camera", "point and shoot", "canon", "nikon", "camera deals"],
    vertical: "Cameras & Printers",
    seasonal: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 6, 6: 7, 7: 7, 8: 6, 9: 6, 10: 8, 11: 10 },
    avgAOV: 500, avgCommRate: 0.03
  },
  "Printers": {
    keywords: ["portable printer", "ink tank printer", "airprint printer", "printer deals"],
    vertical: "Cameras & Printers",
    seasonal: { 0: 7, 1: 6, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 7, 8: 9, 9: 7, 10: 7, 11: 8 },
    avgAOV: 150, avgCommRate: 0.04
  },

  // ADDITIONAL LIFESTYLE
  "Sewing & Crafts": {
    keywords: ["sewing machine", "brother sewing", "craft supplies", "art supply"],
    vertical: "Lifestyle",
    seasonal: { 0: 6, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 7, 9: 8, 10: 9, 11: 10 },
    avgAOV: 200, avgCommRate: 0.04
  },
  "Birding & Nature": {
    keywords: ["bird feeder", "birding", "bird watching", "bird bath"],
    vertical: "Lifestyle",
    seasonal: { 0: 4, 1: 4, 2: 6, 3: 8, 4: 9, 5: 8, 6: 7, 7: 6, 8: 5, 9: 5, 10: 4, 11: 5 },
    avgAOV: 50, avgCommRate: 0.05
  },
  "Sunglasses & Eyewear": {
    keywords: ["sunglasses", "best sunglasses", "glasses cleaner", "polarized sunglasses"],
    vertical: "Lifestyle",
    seasonal: { 0: 3, 1: 3, 2: 5, 3: 7, 4: 9, 5: 10, 6: 10, 7: 9, 8: 7, 9: 5, 10: 3, 11: 3 },
    avgAOV: 100, avgCommRate: 0.05
  }
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const VERTICALS = [...new Set(Object.values(SEASONAL_MODEL).map(c => c.vertical))].sort();

// ============================================================================
// EMBEDDED PERFORMANCE DATA (from CSV upload)
// ============================================================================

const RAW_PERFORMANCE_DATA = [
  { rank: 1, page: "https://www.popsci.com/gear/milwaukee-power-tool-m12-m18-deals-walmart-spring", published: "2026-04-01T17:59:09.000Z", sessions: 15734, clicks: 11888, ctr: 0.76, salesGross: 0, commGross: 1481.26, aov: 0, rpm: 94.14, epc: 0.12, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 2, page: "https://www.popsci.com/gear/walmart-mar10-video-game-deals-switch-ps5-xbox", published: "2026-03-10T21:30:32.000Z", sessions: 42729, clicks: 10240, ctr: 0.24, salesGross: 0, commGross: 674.22, aov: 0, rpm: 15.78, epc: 0.07, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 3, page: "https://www.popsci.com/gear/rei-end-of-season-running-shoe-clearance-deals-hoka-on-brooks", published: "2026-03-09T17:47:01.000Z", sessions: 8910, clicks: 9384, ctr: 1.05, salesGross: 0, commGross: 887.82, aov: 0, rpm: 99.64, epc: 0.09, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 4, page: "https://www.popsci.com/gear/hisense-tv-clearance-mini-led-amazon", published: "2026-03-16T16:34:48.000Z", sessions: 29452, clicks: 6426, ctr: 0.22, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 5, page: "https://www.popsci.com/reviews/best-solar-generators", published: "2025-12-09T14:45:05.000Z", sessions: 5294, clicks: 4399, ctr: 0.83, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Generators,Buying Guide,Power Stations + Batteries + Chargers,Buying Guide,Technology + Computing", site: "popsci.com" },
  { rank: 6, page: "https://www.popsci.com/gear/ego-battery-powered-power-tools-spring-sale-amazon", published: "2026-03-22T23:45:01.000Z", sessions: 9439, clicks: 3448, ctr: 0.37, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 7, page: "https://www.popsci.com/gear/lowes-dewalt-deal-days-power-tool-sale-2026", published: "2026-03-05T14:26:35.000Z", sessions: 9835, clicks: 3039, ctr: 0.31, salesGross: 0, commGross: 66.4, aov: 0, rpm: 6.75, epc: 0.02, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 8, page: "https://www.popsci.com/gear/lowes-ego-days-sale-has-31-deals-on-battery-powered-yard-tools-up-to-200-off", published: "2026-04-02T16:06:27.000Z", sessions: 7085, clicks: 2696, ctr: 0.38, salesGross: 0, commGross: 388.71, aov: 0, rpm: 54.86, epc: 0.14, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 9, page: "https://www.popsci.com/gear/wayfair-grill-deals-flat-top-pizza-oven-spring-sale", published: "2026-03-20T20:33:03.000Z", sessions: 2071, clicks: 1452, ctr: 0.7, salesGross: 0, commGross: 173.39, aov: 0, rpm: 83.72, epc: 0.12, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 10, page: "https://www.popsci.com/gear/greenworks-battery-powered-yard-tool-deals-mowers-blowers-trimmers-amazon", published: "2026-03-30T17:47:42.000Z", sessions: 2526, clicks: 1048, ctr: 0.41, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 11, page: "https://www.popsci.com/gear/best-turntable-speakers", published: "2024-11-20T21:07:10.000Z", sessions: 1182, clicks: 914, ctr: 0.77, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Turntables,Buying Guide,Audio,Technology + Computing", site: "popsci.com" },
  { rank: 12, page: "https://www.popsci.com/gear/best-budget-electric-bikes", published: "2025-05-12T18:15:49.000Z", sessions: 1295, clicks: 639, ctr: 0.49, salesGross: 0, commGross: 59.61, aov: 0, rpm: 46.03, epc: 0.09, tags: "Buying Guide,Electric Bikes", site: "popsci.com" },
  { rank: 13, page: "https://www.popsci.com/gear/best-seat-cushions-for-office-chairs", published: "2024-06-04T17:05:18.000Z", sessions: 902, clicks: 603, ctr: 0.67, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Seating,Buying Guide,Home Furnishings", site: "popsci.com" },
  { rank: 14, page: "https://www.popsci.com/gear/ugreen-spring-sale-docking-station-power-bank", published: "2026-03-27T15:50:53.000Z", sessions: 1169, clicks: 562, ctr: 0.48, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 15, page: "https://www.popsci.com/gear/best-noise-cancelling-headphones-for-airplane-travel", published: "2026-02-20T15:20:25.000Z", sessions: 669, clicks: 538, ctr: 0.8, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Buying Guide", site: "popsci.com" },
  { rank: 16, page: "https://www.popsci.com/gear/ecoflow-big-spring-sale-deals-2026", published: "2026-03-25T13:09:28.000Z", sessions: 1579, clicks: 433, ctr: 0.27, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 17, page: "https://www.popsci.com/gear/best-home-wind-turbines", published: "2024-07-09T19:35:35.000Z", sessions: 1049, clicks: 432, ctr: 0.41, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Buying Guide,Solar Panels,Power Stations", site: "popsci.com" },
  { rank: 18, page: "https://www.popsci.com/gear/best-iems-for-gaming", published: "2025-05-23T14:00:00.000Z", sessions: 680, clicks: 420, ctr: 0.62, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Buying Guide", site: "popsci.com" },
  { rank: 19, page: "https://www.popsci.com/reviews/best-outdoor-tv-antennas", published: "2025-11-26T13:31:18.000Z", sessions: 435, clicks: 386, ctr: 0.89, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "TV + Home Theater,Antennas,Buying Guide", site: "popsci.com" },
  { rank: 20, page: "https://www.popsci.com/gear/best-pocket-microscopes", published: "2024-11-06T14:00:00.000Z", sessions: 662, clicks: 384, ctr: 0.58, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Buying Guide,Microscopes,Science + Education", site: "popsci.com" },
  { rank: 21, page: "https://www.popsci.com/gear/best-deals-amazon-big-spring-sale-2026", published: "2026-03-26T16:06:42.000Z", sessions: 1950, clicks: 383, ctr: 0.2, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 22, page: "https://www.popsci.com/gear/best-monitor-deals-big-spring-sale-2026", published: "2026-03-25T12:19:07.000Z", sessions: 820, clicks: 378, ctr: 0.46, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 23, page: "https://www.popsci.com/gear/jbl-big-spring-sale-deals-2026", published: "2026-03-27T20:55:52.000Z", sessions: 855, clicks: 352, ctr: 0.41, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 24, page: "https://www.popsci.com/reviews/best-wireless-surround-sound-systems", published: "2025-07-25T19:55:34.000Z", sessions: 535, clicks: 335, ctr: 0.63, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Buying Guide,Audio", site: "popsci.com" },
  { rank: 25, page: "https://www.popsci.com/gear/best-iems-for-drummers", published: "2025-08-25T12:55:00.000Z", sessions: 425, clicks: 331, ctr: 0.78, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Buying Guide", site: "popsci.com" },
  { rank: 26, page: "https://www.popsci.com/gear/wolfbox-trail-season-deals-jump-starter-dash-cam", published: "2026-03-17T21:43:18.000Z", sessions: 1352, clicks: 308, ctr: 0.23, salesGross: 0, commGross: 7.11, aov: 0, rpm: 5.26, epc: 0.02, tags: "Deal/Sale", site: "popsci.com" },
  { rank: 27, page: "https://www.popsci.com/gear/best-power-lift-recliners", published: "2025-07-15T02:37:34.000Z", sessions: 383, clicks: 304, ctr: 0.79, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Seating,Buying Guide,Home Furnishings", site: "popsci.com" },
  { rank: 28, page: "https://www.popsci.com/gear/best-electric-commuter-bikes", published: "2025-10-30T14:15:31.000Z", sessions: 672, clicks: 286, ctr: 0.43, salesGross: 0, commGross: 8.75, aov: 0, rpm: 13.02, epc: 0.03, tags: "Buying Guide,Electric Bikes", site: "popsci.com" },
  { rank: 29, page: "https://www.popsci.com/gear/best-portable-saunas", published: "2025-05-21T21:27:59.000Z", sessions: 324, clicks: 281, ctr: 0.87, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Buying Guide,Saunas", site: "popsci.com" },
  { rank: 30, page: "https://www.popsci.com/gear/apple-watch-big-spring-sale-2026", published: "2026-03-25T12:28:14.000Z", sessions: 696, clicks: 271, ctr: 0.39, salesGross: 0, commGross: 0, aov: 0, rpm: 0, epc: 0, tags: "Deal/Sale", site: "popsci.com" },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const classifyPage = (page) => {
  const p = page.toLowerCase();
  for (const [cat, data] of Object.entries(SEASONAL_MODEL)) {
    if (data.keywords.some(kw => p.includes(kw.replace(/\s+/g, '-')) || p.includes(kw.replace(/\s+/g, '')))) {
      return { category: cat, vertical: data.vertical };
    }
  }
  // Broader keyword matching
  if (p.includes('milwaukee') || p.includes('dewalt') || p.includes('power-tool') || p.includes('worx')) return { category: "Cordless Power Tools", vertical: "Power Tools" };
  if (p.includes('ego') || p.includes('greenworks') || p.includes('yard-tool') || p.includes('mower') || p.includes('blower')) return { category: "Battery Yard Tools", vertical: "Outdoor & Yard" };
  if (p.includes('grill') || p.includes('pizza-oven') || p.includes('flat-top')) return { category: "Grills & Outdoor Cooking", vertical: "Outdoor & Yard" };
  if (p.includes('headphone') || p.includes('airpods-max') || p.includes('noise-cancelling')) return { category: "Noise-Canceling Headphones", vertical: "Audio" };
  if (p.includes('earbuds') || p.includes('airpods') || p.includes('linkbuds')) return { category: "Wireless Earbuds", vertical: "Audio" };
  if (p.includes('jbl') || p.includes('speaker') || p.includes('soundboks')) return { category: "Bluetooth Speakers", vertical: "Audio" };
  if (p.includes('turntable') || p.includes('denon') || p.includes('klipsch') || p.includes('surround') || p.includes('audiophile') || p.includes('hi-fi')) return { category: "Home Audio & Hi-Fi", vertical: "Audio" };
  if (p.includes('iem') || p.includes('meze') || p.includes('sennheiser')) return { category: "IEMs & Audiophile", vertical: "Audio" };
  if (p.includes('ecoflow') || p.includes('bluetti') || p.includes('power-station') || p.includes('solar-generator')) return { category: "Portable Power Stations", vertical: "Solar & Power" };
  if (p.includes('solar')) return { category: "Solar Panels & Generators", vertical: "Solar & Power" };
  if (p.includes('generator') || p.includes('wind-turbine')) return { category: "Home Generators & Backup", vertical: "Solar & Power" };
  if (p.includes('apple-watch')) return { category: "Apple Wearables", vertical: "Apple & Tech" };
  if (p.includes('macbook') || p.includes('ipad') || p.includes('m5')) return { category: "MacBooks & iPads", vertical: "Apple & Tech" };
  if (p.includes('monitor') && !p.includes('iem')) return { category: "Monitors", vertical: "Monitors & Displays" };
  if (p.includes('tv') || p.includes('oled') || p.includes('qled') || p.includes('hisense') || p.includes('bravia')) return { category: "TVs", vertical: "Monitors & Displays" };
  if (p.includes('robot-vacuum') || p.includes('ecovacs') || p.includes('shark-robot')) return { category: "Robot Vacuums", vertical: "Smart Home" };
  if (p.includes('eero') || p.includes('wifi') || p.includes('router')) return { category: "Wi-Fi & Networking", vertical: "Smart Home" };
  if (p.includes('security-camera') || p.includes('doorbell')) return { category: "Smart Home Security", vertical: "Smart Home" };
  if (p.includes('kitchenaid') || p.includes('ninja') || p.includes('espresso') || p.includes('delonghi') || p.includes('air-fryer')) return { category: "Kitchen Appliances", vertical: "Home & Kitchen" };
  if (p.includes('dyson') || p.includes('vacuum') || p.includes('shark-vacuum') || p.includes('air-purifier')) return { category: "Vacuums & Cleaning", vertical: "Home & Kitchen" };
  if (p.includes('water-filter') || p.includes('water-flosser') || p.includes('water-pick') || p.includes('waterdrop')) return { category: "Water Filtration", vertical: "Home & Kitchen" };
  if (p.includes('electric-bike') || p.includes('ebike') || p.includes('e-bike') || p.includes('super73')) return { category: "Electric Bikes", vertical: "E-Bikes & Mobility" };
  if (p.includes('3d-print') || p.includes('bambu')) return { category: "3D Printers", vertical: "3D Printing & Maker" };
  if (p.includes('xbox') || p.includes('ps5') || p.includes('switch') || p.includes('game-pass') || p.includes('video-game')) return { category: "Gaming Deals", vertical: "Gaming" };
  if (p.includes('projector')) return { category: "Projectors", vertical: "Home Theater" };
  if (p.includes('golf') || p.includes('putter')) return { category: "Golf Gear", vertical: "Outdoor Sports" };
  if (p.includes('running-shoe') || p.includes('hoka') || p.includes('brooks') || p.includes('on-cloud')) return { category: "Running & Athletic", vertical: "Outdoor Sports" };
  if (p.includes('sauna') || p.includes('fitness') || p.includes('massage')) return { category: "Home Fitness", vertical: "Health & Wellness" };
  if (p.includes('toothbrush') || p.includes('airwrap') || p.includes('high-frequency')) return { category: "Personal Care Tech", vertical: "Health & Wellness" };
  // New expanded categories
  if (p.includes('office-chair') || p.includes('standing-desk') || p.includes('seat-cushion') || p.includes('desk-pad') || p.includes('kneeling-chair') || p.includes('ergonomic')) return { category: "Office Chairs & Ergonomics", vertical: "Office & Furniture" };
  if (p.includes('recliner') || p.includes('massage-chair') || p.includes('lift-chair')) return { category: "Recliners & Home Seating", vertical: "Office & Furniture" };
  if (p.includes('dash-cam') || p.includes('dashcam') || p.includes('head-unit') || p.includes('car-accessor')) return { category: "Dash Cams & Car Tech", vertical: "Auto & Vehicle" };
  if (p.includes('jump-starter') || p.includes('roadside') || p.includes('emergency-kit') || p.includes('wolfbox')) return { category: "Jump Starters & Roadside", vertical: "Auto & Vehicle" };
  if (p.includes('garage-door') || p.includes('garage-heater') || p.includes('motion-sensor') || p.includes('attic-antenna')) return { category: "Garage & Home Maintenance", vertical: "Auto & Vehicle" };
  if (p.includes('drone') || p.includes('dji') && !p.includes('microphone')) return { category: "Drones", vertical: "3D Printing & Maker" };
  if (p.includes('telescope') || p.includes('microscope') || p.includes('metal-detector') || p.includes('arduino') || p.includes('lego') || p.includes('marble-run')) return { category: "Science & Education", vertical: "3D Printing & Maker" };
  if (p.includes('dehumidifier') || p.includes('crawl-space') || p.includes('air-quality-monitor')) return { category: "Dehumidifiers & Air Quality", vertical: "Home & Kitchen" };
  if (p.includes('water-heater') || p.includes('tankless')) return { category: "Water Heaters & Plumbing", vertical: "Home & Kitchen" };
  if (p.includes('misting-fan') || p.includes('desk-fan') || p.includes('outdoor-fan') || p.includes('cooktop')) return { category: "Outdoor Cooling & Fans", vertical: "Home & Kitchen" };
  if (p.includes('camera') && !p.includes('security') && !p.includes('dash') && !p.includes('webcam')) return { category: "Cameras & Photography", vertical: "Cameras & Printers" };
  if (p.includes('printer') && !p.includes('3d')) return { category: "Printers", vertical: "Cameras & Printers" };
  if (p.includes('sewing') || p.includes('art-supply') || p.includes('michaels') || p.includes('craft')) return { category: "Sewing & Crafts", vertical: "Lifestyle" };
  if (p.includes('bird-feeder') || p.includes('bird') && p.includes('feeder')) return { category: "Birding & Nature", vertical: "Lifestyle" };
  if (p.includes('sunglasses') || p.includes('glasses-cleaner') || p.includes('eyewear')) return { category: "Sunglasses & Eyewear", vertical: "Lifestyle" };
  if (p.includes('scooter') && !p.includes('spin')) return { category: "E-Scooters & Alt Transport", vertical: "E-Bikes & Mobility" };
  if (p.includes('smartwatch') || p.includes('garmin') || p.includes('fitness-tracker')) return { category: "Apple Wearables", vertical: "Apple & Tech" };
  if (p.includes('game-controller') || p.includes('ps5-controller') || p.includes('mobile-game')) return { category: "Gaming Deals", vertical: "Gaming" };
  if (p.includes('webcam') || p.includes('streaming-device') || p.includes('mouse') || p.includes('keyboard')) return { category: "Monitors", vertical: "Monitors & Displays" };
  if (p.includes('laptop')) return { category: "MacBooks & iPads", vertical: "Apple & Tech" };
  if (p.includes('kindle') || p.includes('ereader')) return { category: "MacBooks & iPads", vertical: "Apple & Tech" };
  if (p.includes('outdoor-tv') || p.includes('antenna')) return { category: "TVs", vertical: "Monitors & Displays" };
  if (p.includes('lava-lamp') || p.includes('star-projector') || p.includes('photo-blanket')) return { category: "Science & Education", vertical: "3D Printing & Maker" };
  if (p.includes('neck-massager') || p.includes('heating-pad') || p.includes('electrolyte')) return { category: "Home Fitness", vertical: "Health & Wellness" };
  if (p.includes('water-bottle') || p.includes('gallon')) return { category: "Home Fitness", vertical: "Health & Wellness" };
  if (p.includes('battery') || p.includes('rechargeable') || p.includes('power-bank') || p.includes('charging') || p.includes('ugreen')) return { category: "Portable Power Stations", vertical: "Solar & Power" };
  if (p.includes('chair-mat') || p.includes('monitor-stand') || p.includes('desk')) return { category: "Office Chairs & Ergonomics", vertical: "Office & Furniture" };
  return { category: "Uncategorized", vertical: "Other" };
};

// Normalize a page URL or path to a consistent key for merging across CSV formats
// "/gear/some-article/" and "https://www.popsci.com/gear/some-article" both become "/gear/some-article"
const normalizePageKey = (page) => {
  if (!page) return '';
  let path = page;
  try {
    const url = new URL(page);
    path = url.pathname;
  } catch { /* already a relative path */ }
  return path.replace(/\/+$/, '').toLowerCase();
};

const fmt = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
const fmtDollars = (n) => n === 0 ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

const getSlug = (page) => {
  const parts = page.split('/').filter(Boolean);
  const slug = parts[parts.length - 1] || '';
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 60);
};

const getDemandColor = (intensity) => {
  if (intensity >= 9) return { bg: 'rgba(52, 211, 153, 0.2)', text: '#34d399', border: 'rgba(52, 211, 153, 0.4)' };
  if (intensity >= 7) return { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
  if (intensity >= 5) return { bg: 'rgba(251, 191, 36, 0.08)', text: 'rgba(251, 191, 36, 0.6)', border: 'rgba(251, 191, 36, 0.15)' };
  if (intensity >= 3) return { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.08)' };
  return { bg: 'rgba(255,255,255,0.02)', text: 'rgba(255,255,255,0.2)', border: 'rgba(255,255,255,0.05)' };
};

// ============================================================================
// GOOGLE TRENDS LIVE FETCH (with fallback)
// ============================================================================

const TRENDS_CACHE_KEY = 'ps_trends_cache';

const fetchGoogleTrends = async (keyword) => {
  // Use Google Trends embed widget data approach
  // This fetches the interest-over-time data for a keyword
  try {
    const url = `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=240&geo=US&ns=15`;
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      // Google Trends API returns data with a prefix we need to strip
      const json = JSON.parse(text.substring(text.indexOf('{')));
      return json;
    }
  } catch (e) {
    // CORS will likely block this in browser - fall back to seasonal model
    console.log('Trends fetch blocked by CORS, using seasonal model');
  }
  return null;
};

// ============================================================================
// MINI HEATMAP COMPONENT
// ============================================================================

const MiniHeatmap = ({ seasonal, currentMonth, width = 216, height = 20 }) => {
  const cellW = width / 12;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {Array.from({ length: 12 }, (_, i) => {
        const val = seasonal[i];
        const c = getDemandColor(val);
        return (
          <g key={i}>
            <rect x={i * cellW} y={0} width={cellW - 1} height={height} rx={2} fill={c.bg} stroke={i === currentMonth ? '#fbbf24' : 'transparent'} strokeWidth={i === currentMonth ? 1.5 : 0} />
            <text x={i * cellW + cellW / 2} y={height / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize="8" fontFamily="monospace">{val}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ============================================================================
// SPARKLINE COMPONENT
// ============================================================================

const Sparkline = ({ data, width = 120, height = 30, color = '#fbbf24' }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

// ============================================================================
// CSV UPLOAD COMPONENT
// ============================================================================

const CSVUploader = ({ onDataLoaded, label }) => {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);

  const parse = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      vals.push(current.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { onDataLoaded(parse(e.target.result)); } catch (err) { console.error(err); }
    };
    reader.readAsText(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? '#fbbf24' : 'rgba(251,191,36,0.25)'}`,
        borderRadius: 8, padding: '20px 16px', textAlign: 'center',
        backgroundColor: dragging ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer', transition: 'all 0.2s'
      }}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept=".csv,.tsv" onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} style={{ display: 'none' }} />
      <div style={{ fontSize: 13, color: '#e5e7eb', fontFamily: 'system-ui', marginBottom: 4 }}>{label || 'Drop CSV here or click to upload'}</div>
      <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.5)' }}>Supports Google Trends exports & performance CSVs</div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PSCommercePlanner() {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const [activeTab, setActiveTab] = useState('dashboard');
  const [verticalFilter, setVerticalFilter] = useState('All');
  const [perfData, setPerfData] = usePersistedState('ps_perf_data', RAW_PERFORMANCE_DATA);
  const [perfDataTimestamp, setPerfDataTimestamp] = usePersistedState('ps_perf_timestamp', new Date().toISOString());
  const [trendsCSV, setTrendsCSV] = usePersistedState('ps_trends_csv', null);
  const [trendsTimestamp, setTrendsTimestamp] = usePersistedState('ps_trends_timestamp', null);
  const [customCategories, setCustomCategories] = usePersistedState('ps_custom_cats', []);
  const [newCatName, setNewCatName] = useState('');
  const [newCatVertical, setNewCatVertical] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');
  const [sortBy, setSortBy] = useState('sessions');
  const [siteFilter, setSiteFilter] = useState('All');
  const [showLimit, setShowLimit] = useState(100);
  const [contentTypeFilter, setContentTypeFilter] = useState('All');

  // ---- Classify content type from tags ----
  const getContentType = (tags) => {
    if (!tags) return 'Other';
    if (tags.includes('Deal/Sale')) return 'Deal/Sale';
    if (tags.includes('Buying Guide')) return 'Buying Guide';
    if (tags.includes('Feature')) return 'Feature';
    if (tags.includes('Collection/Listicle')) return 'Collection/Listicle';
    return 'Other';
  };

  // ---- Classified performance data ----
  const classifiedPerf = useMemo(() => {
    return perfData.map(row => {
      const cls = classifyPage(row.page);
      const site = row.site || (() => { try { return new URL(row.page).hostname.replace('www.', ''); } catch { return 'unknown'; } })();
      const contentType = getContentType(row.tags);
      return { ...row, ...cls, site, contentType, clickRate: row.sessions > 0 ? row.clicks / row.sessions : 0, convRate: row.clicks > 0 ? (row.commGross > 0 ? 1 : 0) : 0 };
    });
  }, [perfData]);

  // ---- Available sites ----
  const availableSites = useMemo(() => {
    const sites = new Set(classifiedPerf.map(r => r.site).filter(Boolean));
    return ['All', ...Array.from(sites).sort()];
  }, [classifiedPerf]);

  const CONTENT_TYPES = ['All', 'Deal/Sale', 'Buying Guide', 'Feature', 'Collection/Listicle', 'Other'];

  // ---- Filtered by site ----
  const siteFiltered = useMemo(() => {
    let filtered = classifiedPerf;
    if (siteFilter !== 'All') filtered = filtered.filter(r => r.site === siteFilter);
    if (contentTypeFilter !== 'All') filtered = filtered.filter(r => r.contentType === contentTypeFilter);
    return filtered;
  }, [classifiedPerf, siteFilter, contentTypeFilter]);

  // ---- Aggregate by site ----
  const siteAgg = useMemo(() => {
    const agg = {};
    classifiedPerf.forEach(row => {
      const s = row.site || 'unknown';
      if (!agg[s]) agg[s] = { sessions: 0, clicks: 0, commGross: 0, articles: 0 };
      agg[s].sessions += row.sessions;
      agg[s].clicks += row.clicks;
      agg[s].commGross += row.commGross;
      agg[s].articles += 1;
    });
    return agg;
  }, [classifiedPerf]);

  // ---- Aggregate by vertical ----
  const verticalAgg = useMemo(() => {
    const agg = {};
    siteFiltered.forEach(row => {
      const v = row.vertical;
      if (!agg[v]) agg[v] = { sessions: 0, clicks: 0, salesGross: 0, commGross: 0, articles: 0, converting: 0 };
      agg[v].sessions += row.sessions;
      agg[v].clicks += row.clicks;
      agg[v].salesGross += row.salesGross;
      agg[v].commGross += row.commGross;
      agg[v].articles += 1;
      if (row.commGross > 0) agg[v].converting += 1;
    });
    return agg;
  }, [siteFiltered]);

  // ---- Aggregate by category ----
  const categoryAgg = useMemo(() => {
    const agg = {};
    siteFiltered.forEach(row => {
      const c = row.category;
      if (!agg[c]) agg[c] = { sessions: 0, clicks: 0, salesGross: 0, commGross: 0, articles: 0, vertical: row.vertical };
      agg[c].sessions += row.sessions;
      agg[c].clicks += row.clicks;
      agg[c].salesGross += row.salesGross;
      agg[c].commGross += row.commGross;
      agg[c].articles += 1;
    });
    return agg;
  }, [siteFiltered]);

  // ---- Totals ----
  const totals = useMemo(() => {
    return siteFiltered.reduce((t, r) => ({
      sessions: t.sessions + r.sessions, clicks: t.clicks + r.clicks,
      salesGross: t.salesGross + r.salesGross, commGross: t.commGross + r.commGross, articles: t.articles + 1
    }), { sessions: 0, clicks: 0, salesGross: 0, commGross: 0, articles: 0 });
  }, [siteFiltered]);

  // ---- Detect which data fields are available to adapt labels ----
  const dataHas = useMemo(() => {
    const hasSales = siteFiltered.some(r => r.salesGross > 0);
    const hasRpm = siteFiltered.some(r => r.rpm > 0);
    const hasAov = siteFiltered.some(r => r.aov > 0);
    const hasTags = siteFiltered.some(r => r.tags && r.tags.length > 0);
    return { sales: hasSales, rpm: hasRpm, aov: hasAov, tags: hasTags };
  }, [siteFiltered]);

  // ---- Recommendations: Cover Now (high seasonal demand) ----
  const coverNow = useMemo(() => {
    const recs = [];
    const allCats = { ...SEASONAL_MODEL };
    customCategories.forEach(cc => { allCats[cc.name] = cc; });

    Object.entries(allCats).forEach(([cat, data]) => {
      const demand = data.seasonal[currentMonth];
      if (demand >= 7) {
        const existing = categoryAgg[cat];
        const hasRecent = existing && existing.articles > 0;
        const revenue = existing ? existing.commGross : 0;
        const sessions = existing ? existing.sessions : 0;
        recs.push({ category: cat, vertical: data.vertical, demand, hasRecent, revenue, sessions, keywords: data.keywords, seasonal: data.seasonal, avgAOV: data.avgAOV || 200, avgCommRate: data.avgCommRate || 0.04 });
      }
    });
    return recs.sort((a, b) => b.demand - a.demand || b.revenue - a.revenue);
  }, [currentMonth, categoryAgg, customCategories]);

  // ---- Recommendations: Prep for Next Month ----
  const prepNext = useMemo(() => {
    const nextMonth = (currentMonth + 1) % 12;
    const recs = [];
    Object.entries(SEASONAL_MODEL).forEach(([cat, data]) => {
      const currentDemand = data.seasonal[currentMonth];
      const nextDemand = data.seasonal[nextMonth];
      if (nextDemand > currentDemand && nextDemand >= 7) {
        recs.push({ category: cat, vertical: data.vertical, currentDemand, nextDemand, delta: nextDemand - currentDemand, keywords: data.keywords, seasonal: data.seasonal });
      }
    });
    return recs.sort((a, b) => b.delta - a.delta || b.nextDemand - a.nextDemand);
  }, [currentMonth]);

  // ---- Gap Analysis: High demand but no recent coverage ----
  const gaps = useMemo(() => {
    const gapList = [];
    Object.entries(SEASONAL_MODEL).forEach(([cat, data]) => {
      const demand = data.seasonal[currentMonth];
      if (demand >= 6) {
        const existing = categoryAgg[cat];
        const articleCount = existing ? existing.articles : 0;
        if (articleCount === 0) {
          gapList.push({ category: cat, vertical: data.vertical, demand, keywords: data.keywords, seasonal: data.seasonal, avgAOV: data.avgAOV || 200, avgCommRate: data.avgCommRate || 0.04 });
        }
      }
    });
    return gapList.sort((a, b) => b.demand - a.demand);
  }, [currentMonth, categoryAgg]);

  // ---- Revenue Projections ----
  const projections = useMemo(() => {
    // Calculate actual conversion metrics from data
    const convertingArticles = siteFiltered.filter(r => r.commGross > 0);
    const avgCommPerConvertingArticle = convertingArticles.length > 0 ? convertingArticles.reduce((s, r) => s + r.commGross, 0) / convertingArticles.length : 50;
    const avgSessionsPerArticle = totals.articles > 0 ? totals.sessions / totals.articles : 500;
    const overallClickRate = totals.sessions > 0 ? totals.clicks / totals.sessions : 0.3;
    const overallConvRate = convertingArticles.length / Math.max(totals.articles, 1);

    return {
      avgCommPerConvertingArticle: Math.round(avgCommPerConvertingArticle * 100) / 100,
      avgSessionsPerArticle: Math.round(avgSessionsPerArticle),
      overallClickRate,
      overallConvRate,
      convertingCount: convertingArticles.length,
      totalArticles: totals.articles,
      // Projected revenue if we fill gaps
      gapRevenue: gaps.reduce((sum, g) => {
        const projSessions = avgSessionsPerArticle * (g.demand / 7);
        const projClicks = projSessions * overallClickRate;
        const projComm = projClicks * 0.03 * g.avgAOV * g.avgCommRate * 10;
        return sum + projComm;
      }, 0)
    };
  }, [classifiedPerf, totals, gaps]);

  // ---- Sorted performance data ----
  const sortedPerf = useMemo(() => {
    let filtered = [...siteFiltered];
    if (verticalFilter !== 'All') filtered = filtered.filter(r => r.vertical === verticalFilter);
    return filtered.sort((a, b) => {
      if (sortBy === 'sessions') return b.sessions - a.sessions;
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      if (sortBy === 'commission') return b.commGross - a.commGross;
      if (sortBy === 'clickRate') return b.clickRate - a.clickRate;
      if (sortBy === 'sales') return b.salesGross - a.salesGross;
      if (sortBy === 'rpm') return (b.rpm || 0) - (a.rpm || 0);
      return b.sessions - a.sessions;
    });
  }, [siteFiltered, verticalFilter, sortBy]);

  // ---- Stale content opportunities (old articles still driving clicks but $0 earnings) ----
  const staleOpportunities = useMemo(() => {
    return siteFiltered.filter(r => {
      const mod = r.published || '';
      const isOld = mod.includes('2024') || mod.includes('2023') || mod.includes('2022') || mod.includes('2021');
      return r.clicks > 50 && isOld;
    }).sort((a, b) => b.clicks - a.clicks).slice(0, 20);
  }, [siteFiltered]);

  // ---- High-click zero-earnings (missed revenue) ----
  const missedRevenue = useMemo(() => {
    return siteFiltered.filter(r => r.clicks > 100 && r.commGross === 0).sort((a, b) => b.clicks - a.clicks).slice(0, 20);
  }, [siteFiltered]);

  // ---- Handle new performance CSV upload ----
  // Supports both formats and MERGES: each article appears once, most recent upload wins.
  // Format A (commerce): Page (relative path), Sessions, Clicks, Sales Gross, Commissions Gross, AOV
  // Format B (network):  Page (full URL), Pageviews, Clicks, CTR, Earnings, RPM, EPC, Page last modified, Tags
  const handlePerfUpload = (data) => {
    const parseMoney = (v) => { if (!v) return 0; return parseFloat(String(v).replace(/[$,]/g, '')) || 0; };
    const parseNum = (v) => { if (!v) return 0; return parseInt(String(v).replace(/,/g, '')) || 0; };
    const parseFloat2 = (v) => { if (!v) return 0; return parseFloat(String(v).replace(/,/g, '')) || 0; };

    // Detect format by checking for column names unique to each report
    const isNetworkFormat = data[0] && ('Pageviews' in data[0] || 'Earnings' in data[0] || 'RPM' in data[0]);

    // Parse the incoming rows
    const incoming = data.map((row, i) => {
      if (isNetworkFormat) {
        const page = row['Page'] || '';
        return {
          page: page,
          published: row['Page last modified'] || '',
          sessions: parseNum(row['Pageviews']),
          clicks: parseNum(row['Clicks']),
          ctr: parseFloat2(row['CTR']),
          salesGross: 0,
          commGross: parseMoney(row['Earnings']),
          aov: 0,
          rpm: parseFloat2(row['RPM']),
          epc: parseFloat2(row['EPC']),
          tags: row['Tags'] || '',
          site: (() => { try { return new URL(page).hostname.replace('www.', ''); } catch { return 'popsci.com'; } })(),
          _source: 'network'
        };
      } else {
        const rawPage = row['Page'] || row['page'] || '';
        // Normalize relative paths to full URLs so classification works
        const page = rawPage.startsWith('http') ? rawPage : `https://www.popsci.com${rawPage.startsWith('/') ? '' : '/'}${rawPage}`;
        return {
          page: page,
          published: row['Published Date'] || row['published'] || '',
          sessions: parseNum(row['Sessions'] || row['sessions']),
          clicks: parseNum(row['Clicks'] || row['clicks']),
          salesGross: parseMoney(row['Sales Gross'] || row['sales_gross']),
          commGross: parseMoney(row['Commissions Gross'] || row['commissions_gross']),
          aov: parseMoney(row['AOV'] || row['aov']),
          ctr: 0,
          rpm: 0,
          epc: 0,
          tags: '',
          site: 'popsci.com',
          _source: 'commerce'
        };
      }
    }).filter(r => r.page && (r.page.startsWith('http') || r.page.startsWith('/')));

    if (incoming.length === 0) return;

    // Build a map of existing data keyed by normalized path
    const existingMap = new Map();
    perfData.forEach(r => {
      const key = normalizePageKey(r.page);
      if (key) existingMap.set(key, r);
    });

    // Overwrite existing entries with incoming data (most recent upload wins per article)
    const incomingKeys = new Set();
    incoming.forEach(r => {
      const key = normalizePageKey(r.page);
      if (key) {
        incomingKeys.add(key);
        existingMap.set(key, r);
      }
    });

    // Convert map back to array, re-rank by sessions descending
    const merged = Array.from(existingMap.values())
      .sort((a, b) => b.sessions - a.sessions)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    setPerfData(merged);
    setPerfDataTimestamp(new Date().toISOString());
  };

  // ---- Styles ----
  const S = {
    root: { fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#0f1117', color: '#e5e7eb', minHeight: '100vh', padding: '0' },
    header: { padding: '24px 32px 0', borderBottom: '1px solid rgba(251,191,36,0.1)' },
    title: { fontSize: 22, fontWeight: 700, color: '#fbbf24', marginBottom: 4, letterSpacing: '-0.3px' },
    subtitle: { fontSize: 13, color: 'rgba(229,231,235,0.5)', marginBottom: 16 },
    tabs: { display: 'flex', gap: 0, marginTop: 8 },
    tab: (active) => ({ padding: '10px 20px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fbbf24' : 'rgba(229,231,235,0.5)', borderBottom: active ? '2px solid #fbbf24' : '2px solid transparent', cursor: 'pointer', background: 'none', border: 'none', borderBottomStyle: 'solid', transition: 'all 0.15s' }),
    content: { padding: '24px 32px' },
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(251,191,36,0.1)', borderRadius: 10, padding: '20px', marginBottom: 16 },
    cardTitle: { fontSize: 13, fontWeight: 600, color: '#fbbf24', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' },
    metricRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 },
    metric: (color) => ({ flex: '1 1 140px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: 8, padding: '16px' }),
    metricValue: (color) => ({ fontSize: 24, fontWeight: 700, color, fontFamily: 'monospace' }),
    metricLabel: { fontSize: 11, color: 'rgba(229,231,235,0.4)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { textAlign: 'left', padding: '8px 12px', color: 'rgba(251,191,36,0.6)', borderBottom: '1px solid rgba(251,191,36,0.15)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' },
    td: { padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e5e7eb' },
    badge: (bg, text) => ({ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, backgroundColor: bg, color: text }),
    select: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '6px 12px', color: '#e5e7eb', fontSize: 12, outline: 'none' },
    input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '8px 12px', color: '#e5e7eb', fontSize: 13, outline: 'none', width: '100%' },
    button: { background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '8px 16px', color: '#fbbf24', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  };

  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'performance', label: 'Performance' },
    { id: 'seasonal', label: 'Seasonal Calendar' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'gaps', label: 'Gap Analysis' },
    { id: 'trends', label: 'Trends' },
    { id: 'settings', label: 'Settings' },
  ];

  // ============================================================================
  // DASHBOARD TAB
  // ============================================================================

  const renderDashboard = () => (
    <div>
      {/* Site + content type filter bar */}
      {availableSites.length > 2 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <select style={S.select} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
            {availableSites.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sites' : s}</option>)}
          </select>
          <select style={S.select} value={contentTypeFilter} onChange={e => setContentTypeFilter(e.target.value)}>
            {CONTENT_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Content Types' : t}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'rgba(229,231,235,0.4)' }}>{totals.articles.toLocaleString()} articles in view</div>
        </div>
      )}

      {/* Top-line metrics */}
      <div style={S.metricRow}>
        <div style={S.metric('#34d399')}>
          <div style={S.metricValue('#34d399')}>{fmtDollars(totals.commGross)}</div>
          <div style={S.metricLabel}>{dataHas.sales ? 'Total Commissions' : 'Total Earnings'}</div>
        </div>
        {dataHas.sales && (
          <div style={S.metric('#22d3ee')}>
            <div style={S.metricValue('#22d3ee')}>{fmtDollars(totals.salesGross)}</div>
            <div style={S.metricLabel}>Gross Sales</div>
          </div>
        )}
        <div style={S.metric('#60a5fa')}>
          <div style={S.metricValue('#60a5fa')}>{fmt(totals.sessions)}</div>
          <div style={S.metricLabel}>{dataHas.sales ? 'Sessions' : 'Pageviews'}</div>
        </div>
        <div style={S.metric('#a78bfa')}>
          <div style={S.metricValue('#a78bfa')}>{fmt(totals.clicks)}</div>
          <div style={S.metricLabel}>Outbound Clicks</div>
        </div>
        <div style={S.metric('#f472b6')}>
          <div style={S.metricValue('#f472b6')}>{fmtPct(totals.sessions > 0 ? totals.clicks / totals.sessions : 0)}</div>
          <div style={S.metricLabel}>Click-through Rate</div>
        </div>
        <div style={S.metric('#fbbf24')}>
          <div style={S.metricValue('#fbbf24')}>{totals.sessions > 0 ? '$' + (totals.commGross / totals.sessions * 1000).toFixed(2) : '$0'}</div>
          <div style={S.metricLabel}>Revenue per 1k PVs (RPM)</div>
        </div>
      </div>

      {/* Site breakdown (if multi-site) */}
      {Object.keys(siteAgg).length > 1 && siteFilter === 'All' && (
        <div style={S.card}>
          <div style={S.cardTitle}>Earnings by Site</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Site</th>
                <th style={{...S.th, textAlign: 'right'}}>Articles</th>
                <th style={{...S.th, textAlign: 'right'}}>Pageviews</th>
                <th style={{...S.th, textAlign: 'right'}}>Clicks</th>
                <th style={{...S.th, textAlign: 'right'}}>Earnings</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(siteAgg).sort((a, b) => b[1].commGross - a[1].commGross).map(([site, d]) => (
                <tr key={site} style={{ cursor: 'pointer' }} onClick={() => setSiteFilter(site)}>
                  <td style={S.td}><span style={{ fontWeight: 600, color: '#60a5fa' }}>{site}</span></td>
                  <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{d.articles.toLocaleString()}</td>
                  <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(d.sessions)}</td>
                  <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(d.clicks)}</td>
                  <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', color: d.commGross > 0 ? '#34d399' : 'rgba(229,231,235,0.3)'}}>{fmtDollars(d.commGross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: 'rgba(229,231,235,0.3)', marginTop: 8 }}>Click a site name to filter</div>
        </div>
      )}

      {/* Revenue by vertical */}
      <div style={S.card}>
        <div style={S.cardTitle}>Revenue by Vertical{siteFilter !== 'All' ? ` — ${siteFilter}` : ''}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Vertical</th>
              <th style={{...S.th, textAlign: 'right'}}>Articles</th>
              <th style={{...S.th, textAlign: 'right'}}>Sessions</th>
              <th style={{...S.th, textAlign: 'right'}}>Clicks</th>
              <th style={{...S.th, textAlign: 'right'}}>CTR</th>
              <th style={{...S.th, textAlign: 'right'}}>Sales</th>
              <th style={{...S.th, textAlign: 'right'}}>Commission</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(verticalAgg).sort((a, b) => b[1].commGross - a[1].commGross).map(([v, d]) => (
              <tr key={v}>
                <td style={S.td}><span style={{ fontWeight: 600 }}>{v}</span></td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{d.articles}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(d.sessions)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(d.clicks)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmtPct(d.sessions > 0 ? d.clicks / d.sessions : 0)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmtDollars(d.salesGross)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', color: d.commGross > 0 ? '#34d399' : 'rgba(229,231,235,0.3)'}}>{fmtDollars(d.commGross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick wins: Missed revenue */}
      {missedRevenue.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>Missed Revenue — High Clicks, $0 Earnings ({missedRevenue.length} articles)</div>
          <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 12 }}>Articles driving clicks but earning nothing. Check affiliate links, expired deals, or missing retailer data.</div>
          {missedRevenue.slice(0, 10).map((r, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getSlug(r.page)}</div>
                <div style={{ fontSize: 10, color: 'rgba(229,231,235,0.3)' }}>{r.site || ''} {r.contentType !== 'Other' ? `· ${r.contentType}` : ''}</div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#f472b6', whiteSpace: 'nowrap', marginLeft: 12 }}>
                {fmt(r.clicks)} clicks · {fmt(r.sessions)} pvs · CTR {fmtPct(r.clickRate)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick wins: Top earners */}
      <div style={S.card}>
        <div style={S.cardTitle}>Top Earners — Double Down on These</div>
        {(() => {
          const topEarners = siteFiltered.filter(r => r.commGross > 0).sort((a, b) => b.commGross - a.commGross).slice(0, 10);
          return topEarners.map((r, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getSlug(r.page)}</div>
                <div style={{ fontSize: 10, color: 'rgba(229,231,235,0.3)' }}>{r.site || ''} · {r.vertical}</div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#34d399', whiteSpace: 'nowrap', marginLeft: 12 }}>
                {fmtDollars(r.commGross)} · {fmt(r.clicks)} clicks
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Stale content opportunities */}
      {staleOpportunities.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>Stale Content Still Driving Traffic ({staleOpportunities.length} articles)</div>
          <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 12 }}>Articles last updated 2024 or earlier that still get clicks. Refresh these for quick revenue wins.</div>
          {staleOpportunities.slice(0, 10).map((r, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getSlug(r.page)}</div>
                <div style={{ fontSize: 10, color: 'rgba(229,231,235,0.3)' }}>Last updated: {r.published ? r.published.slice(0, 10) : 'unknown'}</div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: r.commGross > 0 ? '#34d399' : '#fbbf24', whiteSpace: 'nowrap', marginLeft: 12 }}>
                {fmt(r.clicks)} clicks · {r.commGross > 0 ? fmtDollars(r.commGross) : '$0 earnings'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // PERFORMANCE TAB
  // ============================================================================

  const renderPerformance = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {availableSites.length > 2 && (
            <select style={S.select} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
              {availableSites.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sites' : s}</option>)}
            </select>
          )}
          <select style={S.select} value={verticalFilter} onChange={e => setVerticalFilter(e.target.value)}>
            <option value="All">All Verticals</option>
            {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select style={S.select} value={contentTypeFilter} onChange={e => setContentTypeFilter(e.target.value)}>
            {CONTENT_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
          </select>
          <select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="sessions">Sort: {dataHas.sales ? 'Sessions' : 'Pageviews'}</option>
            <option value="clicks">Sort: Clicks</option>
            <option value="commission">Sort: {dataHas.sales ? 'Commissions' : 'Earnings'}</option>
            {dataHas.sales && <option value="sales">Sort: Sales</option>}
            <option value="clickRate">Sort: CTR</option>
            <option value="rpm">Sort: RPM</option>
          </select>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.4)' }}>
          Showing {Math.min(showLimit, sortedPerf.length)} of {sortedPerf.length.toLocaleString()} articles
        </div>
      </div>

      <CSVUploader onDataLoaded={handlePerfUpload} label="Upload performance CSV — auto-detects format, merges with existing data" />

      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Article</th>
              <th style={S.th}>Category</th>
              <th style={{...S.th, textAlign: 'right'}}>{dataHas.sales ? 'Sessions' : 'Pageviews'}</th>
              <th style={{...S.th, textAlign: 'right'}}>Clicks</th>
              <th style={{...S.th, textAlign: 'right'}}>CTR</th>
              {dataHas.sales && <th style={{...S.th, textAlign: 'right'}}>Sales</th>}
              <th style={{...S.th, textAlign: 'right'}}>{dataHas.sales ? 'Commissions' : 'Earnings'}</th>
              {dataHas.aov && <th style={{...S.th, textAlign: 'right'}}>AOV</th>}
              <th style={{...S.th, textAlign: 'right'}}>RPM</th>
            </tr>
          </thead>
          <tbody>
            {sortedPerf.slice(0, showLimit).map((r, i) => (
              <tr key={i} style={{ background: r.commGross > 0 ? 'rgba(52,211,153,0.03)' : 'transparent' }}>
                <td style={{...S.td, maxWidth: 320}}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getSlug(r.page)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(229,231,235,0.3)', marginTop: 2 }}>
                    {r.site && r.site !== 'popsci.com' ? <span style={{ color: '#60a5fa' }}>{r.site} · </span> : ''}
                    {r.published ? r.published.slice(0, 10) : ''}
                    {r.contentType !== 'Other' ? ` · ${r.contentType}` : ''}
                  </div>
                </td>
                <td style={S.td}><span style={S.badge(getDemandColor(SEASONAL_MODEL[r.category]?.seasonal?.[currentMonth] || 5).bg, getDemandColor(SEASONAL_MODEL[r.category]?.seasonal?.[currentMonth] || 5).text)}>{r.category === 'Uncategorized' ? r.vertical : r.category}</span></td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(r.sessions)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(r.clicks)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmtPct(r.clickRate)}</td>
                {dataHas.sales && <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', color: r.salesGross > 0 ? '#22d3ee' : 'rgba(229,231,235,0.3)'}}>{fmtDollars(r.salesGross)}</td>}
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', color: r.commGross > 0 ? '#34d399' : 'rgba(229,231,235,0.3)'}}>{fmtDollars(r.commGross)}</td>
                {dataHas.aov && <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{r.aov ? '$' + r.aov.toFixed(2) : '-'}</td>}
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{r.rpm ? '$' + r.rpm.toFixed(2) : (r.sessions > 0 ? '$' + (r.commGross / r.sessions * 1000).toFixed(2) : '-')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedPerf.length > showLimit && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <button style={S.button} onClick={() => setShowLimit(prev => prev + 100)}>Show more ({sortedPerf.length - showLimit} remaining)</button>
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // SEASONAL CALENDAR TAB
  // ============================================================================

  const renderSeasonal = () => {
    const allCats = Object.entries(SEASONAL_MODEL).filter(([, d]) => verticalFilter === 'All' || d.vertical === verticalFilter);
    let currentVertical = '';

    return (
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <select style={S.select} value={verticalFilter} onChange={e => setVerticalFilter(e.target.value)}>
            <option value="All">All Verticals</option>
            {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.5)' }}>Current month highlighted in gold</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {/* Month headers */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
            <div style={{ width: 200, minWidth: 200 }} />
            {MONTH_SHORT.map((m, i) => (
              <div key={i} style={{
                width: 38, minWidth: 38, textAlign: 'center', fontSize: 10, fontFamily: 'monospace',
                color: i === currentMonth ? '#fbbf24' : 'rgba(251,191,36,0.5)',
                fontWeight: i === currentMonth ? 700 : 400
              }}>{m}</div>
            ))}
          </div>

          {allCats.map(([cat, data]) => {
            const showHeader = data.vertical !== currentVertical;
            currentVertical = data.vertical;
            return (
              <React.Fragment key={cat}>
                {showHeader && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(251,191,36,0.4)', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>{data.vertical}</div>
                )}
                <div style={{ display: 'flex', gap: 2, marginBottom: 2, alignItems: 'center' }}>
                  <div style={{ width: 200, minWidth: 200, fontSize: 11, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</div>
                  {Array.from({ length: 12 }, (_, i) => {
                    const val = data.seasonal[i];
                    const c = getDemandColor(val);
                    return (
                      <div key={i} style={{
                        width: 38, minWidth: 38, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: c.bg, border: i === currentMonth ? '1.5px solid #fbbf24' : `1px solid ${c.border}`,
                        borderRadius: 3, fontSize: 10, fontFamily: 'monospace', color: c.text, fontWeight: val >= 8 ? 700 : 400
                      }} title={`${cat} — ${MONTH_NAMES[i]}: ${val}/10`}>{val}</div>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RECOMMENDATIONS TAB
  // ============================================================================

  const renderRecommendations = () => (
    <div>
      {/* Cover Now */}
      <div style={S.card}>
        <div style={S.cardTitle}>Cover Now — {MONTH_NAMES[currentMonth]} High Demand</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 16 }}>Categories with demand {'\u2265'}7 this month. Green = you have coverage. Red = no recent articles.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {coverNow.map((rec, i) => (
            <div key={i} style={{
              ...S.card, marginBottom: 0,
              borderColor: rec.hasRecent ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.3)',
              background: rec.hasRecent ? 'rgba(52,211,153,0.03)' : 'rgba(239,68,68,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{rec.category}</div>
                  <span style={S.badge('rgba(251,191,36,0.12)', 'rgba(251,191,36,0.7)')}>{rec.vertical}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: getDemandColor(rec.demand).text }}>{rec.demand}/10</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(229,231,235,0.4)', marginBottom: 8 }}>{rec.keywords.slice(0, 5).join(', ')}</div>
              {rec.hasRecent ? (
                <div style={{ fontSize: 11, color: '#34d399' }}>You have coverage — {fmtDollars(rec.revenue)} commission so far</div>
              ) : (
                <div style={{ fontSize: 11, color: '#ef4444' }}>No recent coverage — opportunity!</div>
              )}
              <MiniHeatmap seasonal={rec.seasonal} currentMonth={currentMonth} />
            </div>
          ))}
        </div>
      </div>

      {/* Prep for Next Month */}
      <div style={S.card}>
        <div style={S.cardTitle}>Prep Content for {MONTH_NAMES[(currentMonth + 1) % 12]} — Rising Demand</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 16 }}>Categories where demand jumps next month. Write and schedule these now.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {prepNext.slice(0, 8).map((rec, i) => (
            <div key={i} style={{ ...S.card, marginBottom: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>{rec.category}</div>
              <span style={S.badge('rgba(251,191,36,0.12)', 'rgba(251,191,36,0.7)')}>{rec.vertical}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 14, color: getDemandColor(rec.currentDemand).text }}>{rec.currentDemand}</span>
                <span style={{ color: 'rgba(229,231,235,0.3)' }}>{'\u2192'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: getDemandColor(rec.nextDemand).text }}>{rec.nextDemand}</span>
                <span style={{ fontSize: 11, color: '#34d399' }}>+{rec.delta}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(229,231,235,0.4)' }}>{rec.keywords.slice(0, 4).join(', ')}</div>
              <MiniHeatmap seasonal={rec.seasonal} currentMonth={currentMonth} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // GAP ANALYSIS TAB
  // ============================================================================

  const renderGaps = () => (
    <div>
      {/* Revenue projection summary */}
      <div style={S.card}>
        <div style={S.cardTitle}>Revenue Forecast</div>
        <div style={S.metricRow}>
          <div style={S.metric('#34d399')}>
            <div style={S.metricValue('#34d399')}>{fmtDollars(projections.avgCommPerConvertingArticle)}</div>
            <div style={S.metricLabel}>Avg Commission per Converting Article</div>
          </div>
          <div style={S.metric('#60a5fa')}>
            <div style={S.metricValue('#60a5fa')}>{fmtPct(projections.overallConvRate)}</div>
            <div style={S.metricLabel}>Article Conversion Rate ({projections.convertingCount}/{projections.totalArticles})</div>
          </div>
          <div style={S.metric('#fbbf24')}>
            <div style={S.metricValue('#fbbf24')}>{fmtPct(projections.overallClickRate)}</div>
            <div style={S.metricLabel}>Overall Click-through Rate</div>
          </div>
          <div style={S.metric('#f472b6')}>
            <div style={S.metricValue('#f472b6')}>{fmt(projections.avgSessionsPerArticle)}</div>
            <div style={S.metricLabel}>Avg Sessions per Article</div>
          </div>
        </div>
      </div>

      {/* Content gaps */}
      <div style={S.card}>
        <div style={S.cardTitle}>Content Gaps — High Demand, No Coverage ({gaps.length} categories)</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 16 }}>
          Categories with demand {'\u2265'}6 in {MONTH_NAMES[currentMonth]} where you had zero articles in the last 14 days. Each represents a potential revenue opportunity.
        </div>

        {gaps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#34d399', fontSize: 14 }}>Great coverage! No major gaps this month.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {gaps.map((g, i) => {
              const projSessions = projections.avgSessionsPerArticle * (g.demand / 7);
              const projClicks = projSessions * projections.overallClickRate;
              const projComm = projClicks * 0.03 * g.avgAOV * g.avgCommRate * 10;
              return (
                <div key={i} style={{ ...S.card, marginBottom: 0, borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{g.category}</div>
                      <span style={S.badge('rgba(251,191,36,0.12)', 'rgba(251,191,36,0.7)')}>{g.vertical}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: getDemandColor(g.demand).text }}>{g.demand}/10</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(229,231,235,0.4)', marginBottom: 10 }}>{g.keywords.slice(0, 5).join(', ')}</div>
                  <div style={{ background: 'rgba(251,191,36,0.06)', borderRadius: 6, padding: '10px 12px', fontSize: 11 }}>
                    <div style={{ color: 'rgba(229,231,235,0.5)', marginBottom: 4 }}>Projected if covered:</div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: '#60a5fa' }}>{fmt(Math.round(projSessions))} sessions</span>
                      <span style={{ color: '#a78bfa' }}>{fmt(Math.round(projClicks))} clicks</span>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>{fmtDollars(projComm)} est. comm</span>
                    </div>
                  </div>
                  <MiniHeatmap seasonal={g.seasonal} currentMonth={currentMonth} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // TRENDS TAB
  // ============================================================================

  const renderTrends = () => (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Google Trends Data</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 16 }}>
          Upload a Google Trends CSV export to compare real search interest against the seasonal model. The tool will flag anomalies — categories where real search volume significantly exceeds or falls below seasonal expectations.
        </div>
        <CSVUploader onDataLoaded={(data) => { setTrendsCSV(data); setTrendsTimestamp(new Date().toISOString()); }} label="Upload Google Trends CSV export" />
      </div>

      {trendsCSV && trendsCSV.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>Trends vs. Seasonal Model ({trendsCSV.length} keywords)</div>
          <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 12 }}>
            Uploaded: {trendsTimestamp ? new Date(trendsTimestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'unknown'}
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Keyword</th>
                <th style={S.th}>Category</th>
                <th style={{...S.th, textAlign: 'right'}}>Current</th>
                <th style={{...S.th, textAlign: 'right'}}>4wk Avg</th>
                <th style={{...S.th, textAlign: 'right'}}>12wk Avg</th>
                <th style={{...S.th, textAlign: 'right'}}>Expected</th>
                <th style={S.th}>Trend</th>
                <th style={S.th}>vs. Seasonal</th>
              </tr>
            </thead>
            <tbody>
              {trendsCSV.slice(0, 60).map((row, i) => {
                // Support bookmarklet format: Keyword,Category,Current,4wk_Avg,12wk_Avg,Trend
                const term = row['Keyword'] || row[Object.keys(row)[0]] || '';
                const csvCategory = row['Category'] || '';
                const current = parseInt(row['Current']) || parseInt(row[Object.keys(row)[2]]) || 0;
                const avg4 = parseFloat(row['4wk_Avg']) || 0;
                const avg12 = parseFloat(row['12wk_Avg']) || 0;
                const csvTrend = row['Trend'] || '';

                // Match against seasonal model
                let matched = null;
                for (const [cat, data] of Object.entries(SEASONAL_MODEL)) {
                  if (data.keywords.some(kw => term.toLowerCase().includes(kw) || kw.includes(term.toLowerCase()))) {
                    matched = { cat, expected: data.seasonal[currentMonth] * 10 };
                    break;
                  }
                }
                const expected = matched ? matched.expected : 50;
                const ratio = expected > 0 ? current / expected : 1;
                let vsStatus = 'On track';
                let vsColor = '#fbbf24';
                if (ratio > 1.5) { vsStatus = 'Hot'; vsColor = '#34d399'; }
                else if (ratio > 1.15) { vsStatus = 'Above'; vsColor = '#34d399'; }
                else if (ratio < 0.5) { vsStatus = 'Cold'; vsColor = '#ef4444'; }
                else if (ratio < 0.85) { vsStatus = 'Below'; vsColor = '#ef4444'; }

                const trendColor = csvTrend === 'Rising' ? '#34d399' : csvTrend === 'Falling' ? '#ef4444' : '#fbbf24';

                return (
                  <tr key={i}>
                    <td style={S.td}>{term}</td>
                    <td style={S.td}>{matched ? matched.cat : (csvCategory || <span style={{ color: 'rgba(229,231,235,0.3)' }}>—</span>)}</td>
                    <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600}}>{current}</td>
                    <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', color: 'rgba(229,231,235,0.5)'}}>{avg4 ? avg4.toFixed(0) : '-'}</td>
                    <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', color: 'rgba(229,231,235,0.5)'}}>{avg12 ? avg12.toFixed(0) : '-'}</td>
                    <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{expected}</td>
                    <td style={S.td}><span style={S.badge(trendColor + '22', trendColor)}>{csvTrend || '-'}</span></td>
                    <td style={S.td}><span style={S.badge(vsColor + '22', vsColor)}>{vsStatus}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Built-in seasonal model as fallback */}
      <div style={S.card}>
        <div style={S.cardTitle}>Seasonal Demand Model — {MONTH_NAMES[currentMonth]} Snapshot</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 16 }}>
          Built-in seasonal curves based on historical search patterns. Use as a baseline when live Trends data isn't available.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {Object.entries(SEASONAL_MODEL).sort((a, b) => b[1].seasonal[currentMonth] - a[1].seasonal[currentMonth]).slice(0, 12).map(([cat, data]) => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: `1px solid ${getDemandColor(data.seasonal[currentMonth]).border}` }}>
              <div>
                <div style={{ fontSize: 12, color: '#e5e7eb' }}>{cat}</div>
                <div style={{ fontSize: 10, color: 'rgba(229,231,235,0.4)' }}>{data.vertical}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: getDemandColor(data.seasonal[currentMonth]).text }}>{data.seasonal[currentMonth]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // SETTINGS TAB
  // ============================================================================

  const renderSettings = () => (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Add Custom Category</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 16 }}>Add product categories beyond the built-in model.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={S.input} placeholder="Category name (e.g., Drones)" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
          <input style={S.input} placeholder="Vertical (e.g., Tech)" value={newCatVertical} onChange={e => setNewCatVertical(e.target.value)} />
          <input style={S.input} placeholder="Keywords (comma-separated)" value={newCatKeywords} onChange={e => setNewCatKeywords(e.target.value)} />
          <button style={S.button} onClick={() => {
            if (newCatName && newCatKeywords) {
              setCustomCategories(prev => [...prev, {
                name: newCatName,
                vertical: newCatVertical || 'Custom',
                keywords: newCatKeywords.split(',').map(k => k.trim().toLowerCase()),
                seasonal: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5 },
                avgAOV: 200, avgCommRate: 0.04
              }]);
              setNewCatName(''); setNewCatVertical(''); setNewCatKeywords('');
            }
          }}>Add Category</button>
        </div>
        {customCategories.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24', marginBottom: 8 }}>Custom Categories:</div>
            {customCategories.map((cc, i) => (
              <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#e5e7eb', fontSize: 13 }}>{cc.name}</span>
                  <span style={{ color: 'rgba(229,231,235,0.4)', fontSize: 11, marginLeft: 8 }}>{cc.vertical}</span>
                </div>
                <button style={{ ...S.button, padding: '4px 10px', fontSize: 11 }} onClick={() => setCustomCategories(prev => prev.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Upload New Performance Data</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 12 }}>
          Current data uploaded: {perfDataTimestamp ? new Date(perfDataTimestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Built-in default'}
          {trendsTimestamp && <span style={{ marginLeft: 16 }}>Trends data: {new Date(trendsTimestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
        </div>
        <CSVUploader onDataLoaded={handlePerfUpload} label="Replace performance data with new CSV" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Data Management</div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.5)', marginBottom: 12 }}>
          All uploaded data is saved in your browser's local storage. It persists across page refreshes but is specific to this browser.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ ...S.button, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }} onClick={() => {
            if (window.confirm('Reset all data to defaults? This clears uploaded CSVs, custom categories, and trends data.')) {
              setPerfData(RAW_PERFORMANCE_DATA);
              setPerfDataTimestamp(new Date().toISOString());
              setTrendsCSV(null);
              setTrendsTimestamp(null);
              setCustomCategories([]);
            }
          }}>Reset All Data to Defaults</button>
          <button style={S.button} onClick={() => {
            const exportData = { perfData, customCategories, trendsCSV, exportedAt: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `ps-commerce-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
            URL.revokeObjectURL(url);
          }}>Export All Data as JSON</button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.title}>PopSci Commerce Planner</div>
        <div style={S.subtitle}>Commerce coverage intelligence — {MONTH_NAMES[currentMonth]} {now.getFullYear()} — {totals.articles.toLocaleString()} articles tracked{siteFilter !== 'All' ? ` (${siteFilter})` : ''} — Data: {perfDataTimestamp ? new Date(perfDataTimestamp).toLocaleDateString() : 'default'}</div>
        <div style={S.tabs}>
          {TABS.map(t => (
            <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <div style={S.content}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'seasonal' && renderSeasonal()}
        {activeTab === 'recommendations' && renderRecommendations()}
        {activeTab === 'gaps' && renderGaps()}
        {activeTab === 'trends' && renderTrends()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
}
