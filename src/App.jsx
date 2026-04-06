import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';

// ============================================================================
// LOCALSTORAGE PERSISTENCE HOOK
// Keeps uploaded data across page refreshes on Netlify
// ============================================================================

const usePersistedState = (key, initialValue) => {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
    } catch (e) { /* ignore */ }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) { /* ignore quota errors */ }
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
  { rank: 1, page: "/gear/milwaukee-power-tool-m12-m18-deals-walmart-spring/", published: "2026-04-01", sessions: 11900, clicks: 8294, salesGross: 6685.87, commGross: 312.01, aov: 58.65 },
  { rank: 2, page: "/gear/ego-battery-powered-power-tools-spring-sale-amazon/", published: "2026-03-22", sessions: 10007, clicks: 3088, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 3, page: "/gear/lowes-ego-days-sale-has-31-deals-on-battery-powered-yard-tools-up-to-200-off/", published: "2026-04-02", sessions: 7610, clicks: 2388, salesGross: 8743.08, commGross: 209.24, aov: 273.22 },
  { rank: 4, page: "/reviews/best-solar-generators/", published: "2022-01-26", sessions: 3465, clicks: 1896, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 5, page: "/gear/greenworks-battery-powered-yard-tool-deals-mowers-blowers-trimmers-amazon/", published: "2026-03-30", sessions: 2765, clicks: 947, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 6, page: "/gear/apple-airpods-max-2-anc-headphones-h2-chip-hdr-amp-platform-architecture-interview/", published: "2026-03-31", sessions: 2470, clicks: 5, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 7, page: "/gear/ecoflow-big-spring-sale-deals-2026/", published: "2026-03-25", sessions: 2081, clicks: 407, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 8, page: "/gear/ugreen-spring-sale-docking-station-power-bank/", published: "2026-03-27", sessions: 1910, clicks: 513, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 9, page: "/gear/cobra-3d-printed-putters-enzo-pista-3dp-tour-golf-clubs/", published: "2026-03-31", sessions: 1402, clicks: 52, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 10, page: "/gear/best-deals-amazon-big-spring-sale-2026/", published: "2026-03-25", sessions: 1351, clicks: 344, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 11, page: "/gear/jbl-big-spring-sale-deals-2026/", published: "2026-03-27", sessions: 1054, clicks: 326, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 12, page: "/gear/best-monitor-deals-big-spring-sale-2026/", published: "2026-03-25", sessions: 928, clicks: 336, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 13, page: "/gear/apple-deals-ipad-airpods-macbook-big-spring-sale-deals/", published: "2026-03-25", sessions: 910, clicks: 128, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 14, page: "/gear/wiim-connected-multiroom-audio-streaming-amp-amazon-prime-big-spring-sale/", published: "2026-03-25", sessions: 903, clicks: 150, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 15, page: "/gear/apple-watch-big-spring-sale-2026/", published: "2026-03-25", sessions: 783, clicks: 251, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 16, page: "/gear/best-turntable-speakers/", published: "2023-06-22", sessions: 712, clicks: 361, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 17, page: "/gear/best-iems-for-gaming/", published: "2025-05-23", sessions: 704, clicks: 162, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 18, page: "/gear/iniu-charging-accessories-portable-power-bank-spring-deals/", published: "2026-03-30", sessions: 669, clicks: 210, salesGross: 222.54, commGross: 17.80, aov: 27.82 },
  { rank: 19, page: "/gear/amazon-big-spring-sale-home-deals-26/", published: "2026-03-27", sessions: 666, clicks: 287, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 20, page: "/gear/sony-bravia-theater-home-audio-bar-sub-rear-speakers-mid-tier-led-tv-product-news/", published: "2026-03-25", sessions: 654, clicks: 39, salesGross: 1224.98, commGross: 36.75, aov: 408.33 },
  { rank: 21, page: "/gear/best-pocket-microscopes/", published: "2024-11-06", sessions: 617, clicks: 175, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 22, page: "/gear/best-budget-electric-bikes/", published: "2022-12-14", sessions: 545, clicks: 252, salesGross: 570, commGross: 17.10, aov: 142.50 },
  { rank: 23, page: "/gear/kitchenaid-artisan-plus-updated-tilt-head-stand-mixer-product-news/", published: "2026-03-30", sessions: 527, clicks: 40, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 24, page: "/gear/best-seat-cushions-for-office-chairs/", published: "2024-04-11", sessions: 486, clicks: 264, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 25, page: "/gear/waterdrop-g3p800-water-filter-system-review/", published: "2026-04-03", sessions: 437, clicks: 24, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 26, page: "/gear/best-home-wind-turbines/", published: "2022-08-04", sessions: 397, clicks: 154, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 27, page: "/gear/best-noise-cancelling-headphones-for-airplane-travel/", published: "2025-07-03", sessions: 377, clicks: 233, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 28, page: "/gear/best-electric-commuter-bikes/", published: "2024-02-28", sessions: 368, clicks: 115, salesGross: 26.93, commGross: 2.15, aov: 26.93 },
  { rank: 29, page: "/gear/dewalt-big-spring-sale-deals-2026/", published: "2026-03-25", sessions: 354, clicks: 205, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 30, page: "/gear/portable-power-station-solar-generator-deals-amazon-spring-prime-day/", published: "2026-03-26", sessions: 346, clicks: 105, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 31, page: "/gear/best-iems-for-drummers/", published: "2025-08-25", sessions: 342, clicks: 167, salesGross: 0, commGross: 0, aov: 0 },
  { rank: 32, page: "/gear/wayfair-grill-deals-flat-top-pizza-oven-spring-sale/", published: "2026-03-20", sessions: 245, clicks: 119, salesGross: 1164.93, commGross: 111.72, aov: 145.62 },
  { rank: 33, page: "/gear/rei-end-of-season-running-shoe-clearance-deals-hoka-on-brooks/", published: "2026-03-09", sessions: 183, clicks: 7, salesGross: 1736.46, commGross: 121.55, aov: 289.41 },
  { rank: 34, page: "/gear/best-folding-electric-bikes/", published: "2024-03-08", sessions: 128, clicks: 41, salesGross: 1558.99, commGross: 109.13, aov: 1558.99 },
  { rank: 35, page: "/gear/best-chair-mats/", published: "2024-01-29", sessions: 146, clicks: 60, salesGross: 798.40, commGross: 65.47, aov: 798.40 },
  { rank: 36, page: "/gear/best-attic-antennas/", published: "2022-09-17", sessions: 155, clicks: 82, salesGross: 125.70, commGross: 2.51, aov: 125.70 },
  { rank: 37, page: "/gear/old-navy-season-end-clearance-shirts-pants-jackets/", published: "2026-03-12", sessions: 262, clicks: 0, salesGross: 27.93, commGross: 0.23, aov: 27.93 },
  { rank: 38, page: "/gear/walmart-mar10-video-game-deals-switch-ps5-xbox/", published: "2026-03-10", sessions: 150, clicks: 17, salesGross: 162.69, commGross: 0.23, aov: 5.42 },
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

  // ---- Classified performance data ----
  const classifiedPerf = useMemo(() => {
    return perfData.map(row => {
      const cls = classifyPage(row.page);
      return { ...row, ...cls, clickRate: row.sessions > 0 ? row.clicks / row.sessions : 0, convRate: row.clicks > 0 ? (row.salesGross > 0 ? 1 : 0) : 0 };
    });
  }, [perfData]);

  // ---- Aggregate by vertical ----
  const verticalAgg = useMemo(() => {
    const agg = {};
    classifiedPerf.forEach(row => {
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
  }, [classifiedPerf]);

  // ---- Aggregate by category ----
  const categoryAgg = useMemo(() => {
    const agg = {};
    classifiedPerf.forEach(row => {
      const c = row.category;
      if (!agg[c]) agg[c] = { sessions: 0, clicks: 0, salesGross: 0, commGross: 0, articles: 0, vertical: row.vertical };
      agg[c].sessions += row.sessions;
      agg[c].clicks += row.clicks;
      agg[c].salesGross += row.salesGross;
      agg[c].commGross += row.commGross;
      agg[c].articles += 1;
    });
    return agg;
  }, [classifiedPerf]);

  // ---- Totals ----
  const totals = useMemo(() => {
    return classifiedPerf.reduce((t, r) => ({
      sessions: t.sessions + r.sessions, clicks: t.clicks + r.clicks,
      salesGross: t.salesGross + r.salesGross, commGross: t.commGross + r.commGross, articles: t.articles + 1
    }), { sessions: 0, clicks: 0, salesGross: 0, commGross: 0, articles: 0 });
  }, [classifiedPerf]);

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
    const convertingArticles = classifiedPerf.filter(r => r.commGross > 0);
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
    const filtered = verticalFilter === 'All' ? [...classifiedPerf] : classifiedPerf.filter(r => r.vertical === verticalFilter);
    return filtered.sort((a, b) => {
      if (sortBy === 'sessions') return b.sessions - a.sessions;
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      if (sortBy === 'commission') return b.commGross - a.commGross;
      if (sortBy === 'clickRate') return b.clickRate - a.clickRate;
      if (sortBy === 'sales') return b.salesGross - a.salesGross;
      return b.sessions - a.sessions;
    });
  }, [classifiedPerf, verticalFilter, sortBy]);

  // ---- Handle new performance CSV upload ----
  const handlePerfUpload = (data) => {
    const parsed = data.map((row, i) => {
      const parseMoney = (v) => { if (!v) return 0; return parseFloat(String(v).replace(/[$,]/g, '')) || 0; };
      const parseNum = (v) => { if (!v) return 0; return parseInt(String(v).replace(/,/g, '')) || 0; };
      return {
        rank: i + 1,
        page: row['Page'] || row['page'] || '',
        published: row['Published Date'] || row['published'] || '',
        sessions: parseNum(row['Sessions'] || row['sessions']),
        clicks: parseNum(row['Clicks'] || row['clicks']),
        salesGross: parseMoney(row['Sales Gross'] || row['sales_gross']),
        commGross: parseMoney(row['Commissions Gross'] || row['commissions_gross']),
        aov: parseMoney(row['AOV'] || row['aov'])
      };
    }).filter(r => r.page);
    if (parsed.length > 0) {
      setPerfData(parsed);
      setPerfDataTimestamp(new Date().toISOString());
    }
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
      {/* Top-line metrics */}
      <div style={S.metricRow}>
        <div style={S.metric('#34d399')}>
          <div style={S.metricValue('#34d399')}>{fmtDollars(totals.commGross)}</div>
          <div style={S.metricLabel}>Total Commission (14d)</div>
        </div>
        <div style={S.metric('#fbbf24')}>
          <div style={S.metricValue('#fbbf24')}>{fmtDollars(totals.salesGross)}</div>
          <div style={S.metricLabel}>Gross Sales (14d)</div>
        </div>
        <div style={S.metric('#60a5fa')}>
          <div style={S.metricValue('#60a5fa')}>{fmt(totals.sessions)}</div>
          <div style={S.metricLabel}>Total Sessions</div>
        </div>
        <div style={S.metric('#a78bfa')}>
          <div style={S.metricValue('#a78bfa')}>{fmt(totals.clicks)}</div>
          <div style={S.metricLabel}>Outbound Clicks</div>
        </div>
        <div style={S.metric('#f472b6')}>
          <div style={S.metricValue('#f472b6')}>{fmtPct(totals.sessions > 0 ? totals.clicks / totals.sessions : 0)}</div>
          <div style={S.metricLabel}>Click-through Rate</div>
        </div>
      </div>

      {/* Revenue by vertical */}
      <div style={S.card}>
        <div style={S.cardTitle}>Revenue by Vertical</div>
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

      {/* Quick wins */}
      <div style={S.card}>
        <div style={S.cardTitle}>Quick Revenue Wins</div>
        <div style={{ fontSize: 13, color: 'rgba(229,231,235,0.7)', lineHeight: 1.7 }}>
          {(() => {
            const highTrafficNoRev = classifiedPerf.filter(r => r.sessions > 500 && r.commGross === 0 && r.clicks > 100).sort((a, b) => b.sessions - a.sessions).slice(0, 5);
            const highConv = classifiedPerf.filter(r => r.commGross > 0).sort((a, b) => (b.commGross / Math.max(b.sessions, 1)) - (a.commGross / Math.max(a.sessions, 1))).slice(0, 3);

            return (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#f472b6', marginBottom: 8 }}>High-traffic articles with clicks but $0 commission — check affiliate links:</div>
                  {highTrafficNoRev.map((r, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#e5e7eb' }}>{getSlug(r.page)}</span>
                      <span style={{ fontFamily: 'monospace', color: 'rgba(251,191,36,0.7)' }}>{fmt(r.sessions)} sessions / {fmt(r.clicks)} clicks</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#34d399', marginBottom: 8 }}>Highest commission per session — double down on these:</div>
                  {highConv.map((r, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#e5e7eb' }}>{getSlug(r.page)}</span>
                      <span style={{ fontFamily: 'monospace', color: '#34d399' }}>{fmtDollars(r.commGross)} comm / {fmtDollars(r.commGross / Math.max(r.sessions, 1) * 1000)}/1k sessions</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // PERFORMANCE TAB
  // ============================================================================

  const renderPerformance = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select style={S.select} value={verticalFilter} onChange={e => setVerticalFilter(e.target.value)}>
            <option value="All">All Verticals</option>
            {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="sessions">Sort: Sessions</option>
            <option value="clicks">Sort: Clicks</option>
            <option value="commission">Sort: Commission</option>
            <option value="clickRate">Sort: CTR</option>
            <option value="sales">Sort: Sales</option>
          </select>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.4)' }}>{sortedPerf.length} articles</div>
      </div>

      <CSVUploader onDataLoaded={handlePerfUpload} label="Upload new performance CSV to replace data" />

      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Article</th>
              <th style={S.th}>Vertical</th>
              <th style={{...S.th, textAlign: 'right'}}>Sessions</th>
              <th style={{...S.th, textAlign: 'right'}}>Clicks</th>
              <th style={{...S.th, textAlign: 'right'}}>CTR</th>
              <th style={{...S.th, textAlign: 'right'}}>Sales</th>
              <th style={{...S.th, textAlign: 'right'}}>Commission</th>
            </tr>
          </thead>
          <tbody>
            {sortedPerf.slice(0, 50).map((r, i) => (
              <tr key={i} style={{ background: r.commGross > 0 ? 'rgba(52,211,153,0.03)' : 'transparent' }}>
                <td style={{...S.td, maxWidth: 300}}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getSlug(r.page)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(229,231,235,0.3)', marginTop: 2 }}>{r.published}</div>
                </td>
                <td style={S.td}><span style={S.badge(getDemandColor(SEASONAL_MODEL[r.category]?.seasonal?.[currentMonth] || 5).bg, getDemandColor(SEASONAL_MODEL[r.category]?.seasonal?.[currentMonth] || 5).text)}>{r.vertical}</span></td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(r.sessions)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmt(r.clicks)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmtPct(r.clickRate)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{fmtDollars(r.salesGross)}</td>
                <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace', color: r.commGross > 0 ? '#34d399' : 'rgba(229,231,235,0.3)'}}>{fmtDollars(r.commGross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div style={S.cardTitle}>Trends vs. Seasonal Model</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Search Term</th>
                <th style={S.th}>Matched Category</th>
                <th style={{...S.th, textAlign: 'right'}}>Trend Value</th>
                <th style={{...S.th, textAlign: 'right'}}>Expected</th>
                <th style={S.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {trendsCSV.slice(0, 50).map((row, i) => {
                const keys = Object.keys(row);
                const term = row[keys[0]] || '';
                const value = parseInt(row[keys[1]]) || 0;
                // Try to match against seasonal model
                let matched = null;
                for (const [cat, data] of Object.entries(SEASONAL_MODEL)) {
                  if (data.keywords.some(kw => term.toLowerCase().includes(kw) || kw.includes(term.toLowerCase()))) {
                    matched = { cat, expected: data.seasonal[currentMonth] * 10 };
                    break;
                  }
                }
                const expected = matched ? matched.expected : 50;
                const ratio = expected > 0 ? value / expected : 1;
                let status = 'On track';
                let statusColor = '#fbbf24';
                if (ratio > 1.5) { status = 'Above seasonal'; statusColor = '#34d399'; }
                else if (ratio < 0.5) { status = 'Below seasonal'; statusColor = '#ef4444'; }

                return (
                  <tr key={i}>
                    <td style={S.td}>{term}</td>
                    <td style={S.td}>{matched ? matched.cat : <span style={{ color: 'rgba(229,231,235,0.3)' }}>Unmatched</span>}</td>
                    <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{value}</td>
                    <td style={{...S.td, textAlign: 'right', fontFamily: 'monospace'}}>{expected}</td>
                    <td style={S.td}><span style={S.badge(statusColor + '22', statusColor)}>{status}</span></td>
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
        <div style={S.subtitle}>Commerce coverage intelligence — {MONTH_NAMES[currentMonth]} {now.getFullYear()} — {totals.articles} articles tracked — Data: {perfDataTimestamp ? new Date(perfDataTimestamp).toLocaleDateString() : 'default'}</div>
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
