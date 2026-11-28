(() => {
  'use strict';

  // =========================================================================
  // CONSTANTS & SHARED REPO CONFIGURATION
  // =========================================================================
  const SHOP_GSTIN = '21AFNPP7926E1ZC';
  const ADMIN_APP_VERSION = 'v1.0.2 Beta';
  const CATALOG_REPO_ADMIN = 'satyanarayanjewellery';
  const CATALOG_REPO_NAME = 'shop';
  const CATALOG_REPO_BRANCH = 'main';
  const CATALOG_MANIFEST_REPO_PATH = 'catalog/products.json';
  const CATALOG_MANIFEST_FETCH_PATH = '../catalog/products.json';
  const CATALOG_MEDIA_PREFIX = 'catalog/media/';
  const STATUTORY_REPO_PATH = 'catalog/statutory-rates.json';
  const STATUTORY_FETCH_PATH = '../catalog/statutory-rates.json';

  const ADMIN_GH_TOKEN_KEY = 'sj_product_admin_gh_token_v1';
  const ADMIN_VERIFIED_META_KEY = 'sj_admin_verified_meta_v1';
  const STORAGE_KEYS = {
    lastRates: 'satyanarayan_last_rates_v1',
    rateOfDay: 'satyanarayan_rate_of_day_v1',
    statutoryRates: 'satyanarayan_statutory_rates_v1',
    orderBook: 'satyanarayan_admin_orders_v1',
    billSeq: 'satyanarayan_admin_bill_seq_v1'
  };

  const MAX_MEDIA_PER_ITEM = 6;
  const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
  const MAX_VIDEO_PUBLISH_BYTES = 20 * 1024 * 1024;
  const MAX_VIDEO_LOCAL_BYTES = 50 * 1024 * 1024;
  const ALLOWED_IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif)$/i;
  const ALLOWED_VIDEO_MIME = /^video\/(mp4|webm|quicktime)$/i;

  const TROY_OZ_TO_GRAMS = 31.1034768;
  const DEFAULT_STATUTORY_RATES = {
    gold: {
      importDutyPct: 15, gstPct: 3, effectiveFrom: '2026-05-13', verifiedOn: '2026-11-27',
      note: '10% Basic Customs Duty + 5% AIDC (Customs Notification 16/2026); 3% GST',
      sources: ['https://www.cbic.gov.in/entities/view-sticky/38', 'https://www.indiabudget.gov.in/']
    },
    silver: {
      importDutyPct: 15, gstPct: 3, effectiveFrom: '2026-05-13', verifiedOn: '2026-11-27',
      note: '10% Basic Customs Duty + 5% AIDC (Customs Notification 16/2026); 3% GST',
      sources: ['https://www.cbic.gov.in/entities/view-sticky/38', 'https://www.indiabudget.gov.in/']
    }
  };
  const STATUTORY_REVIEW_DAYS = 180;
  const SPOT_BANDS = { gold: { min: 200, max: 30000 }, silver: { min: 2, max: 1000 } };
  const MAX_SPOT_MOVE_PCT = 0.12;
  const USD_INR_MIN = 60;
  const USD_INR_MAX = 120;
  const USD_INR_MAX_MOVE_PCT = 0.02;
  const FX_LIVE_REFRESH_MS = 60 * 1000;
  const FX_DAILY_REFRESH_MS = 15 * 60 * 1000;
  const FX_DAILY_HEDGE_MS = 700;
  const REST_FALLBACK_MS = 5000;
  const LIVE_TICK_FRESH_MS = 90 * 1000;

  const CITIES = {
    cuttack:   { name: 'Cuttack',   state: 'Odisha',         factor: 1.0000 },
    mumbai:    { name: 'Mumbai',    state: 'Maharashtra',    factor: 1.0000 },
    kolkata:   { name: 'Kolkata',   state: 'West Bengal',    factor: 1.0000 },
    pune:      { name: 'Pune',      state: 'Maharashtra',    factor: 1.0000 },
    bengaluru: { name: 'Bengaluru', state: 'Karnataka',      factor: 1.0000 },
    hyderabad: { name: 'Hyderabad', state: 'Telangana',      factor: 1.0000 },
    chennai:   { name: 'Chennai',   state: 'Tamil Nadu',     factor: 1.0000 },
    ahmedabad: { name: 'Ahmedabad', state: 'Gujarat',        factor: 1.0004 },
    patna:     { name: 'Patna',     state: 'Bihar',          factor: 1.0004 },
    delhi:     { name: 'Delhi',     state: 'Delhi',          factor: 1.0012 },
    jaipur:    { name: 'Jaipur',    state: 'Rajasthan',      factor: 1.0012 },
    lucknow:   { name: 'Lucknow',   state: 'Uttar Pradesh',  factor: 1.0012 }
  };

  const CURRENCY_PER_USD = {
    USD: 1, INR: 1, CNY: 7.25, HKD: 7.80, SGD: 1.35, AED: 3.6725, SAR: 3.75, QAR: 3.64, KWD: 0.308,
    JPY: 149.0, KRW: 1390.0, THB: 35.0, MYR: 4.40, IDR: 16000.0, PHP: 58.0, TWD: 32.20,
    VND: 25400.0, LKR: 290.0, BHD: 0.377, OMR: 0.385, JOD: 0.710, NPR: 1.60, BDT: 120.0,
    PKR: 280.0, IRR: 42000.0, UAH: 41.0, GBP: 0.79, EUR: 0.92, CHF: 0.89, AUD: 1.55, CAD: 1.38,
    NZD: 1.78, ZAR: 18.50, EGP: 49.50, KES: 129.0, NGN: 1550.0, GHS: 14.50, TRY: 35.0, ILS: 3.70,
    RUB: 93.0, MXN: 19.50, BRL: 5.30, ARS: 1100.0, CLP: 920.0, PEN: 3.75, COP: 4100.0, UYU: 40.50,
    NOK: 11.20, SEK: 10.90, DKK: 6.90, PLN: 3.95, CZK: 23.40, HUF: 370.0, RON: 4.70, BGN: 1.78,
    LBP: 89500.0
  };

  const EXCHANGE_MARKETS = [
    { id: 'x-001', name: 'Satyanarayan Jewellers', city: 'Cuttack', state: 'Odisha', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0, isShop: true },
    { id: 'x-002', name: 'MCX', city: 'Mumbai', state: 'Maharashtra', country: 'India', currency: 'INR', metal: 'both', basisPct: 0.10 },
    { id: 'x-003', name: 'IBJA', city: 'Mumbai', state: 'Maharashtra', country: 'India', currency: 'INR', metal: 'both', basisPct: 0.05 },
    { id: 'x-004', name: 'Bombay Bullion Association', city: 'Mumbai', state: 'Maharashtra', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.08 },
    { id: 'x-005', name: 'Zaveri Bazaar Bullion Market', city: 'Mumbai', state: 'Maharashtra', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.12 },
    { id: 'x-006', name: 'Chennai Jewellers Association', city: 'Chennai', state: 'Tamil Nadu', country: 'India', currency: 'INR', metal: 'gold', basisPct: -0.05 },
    { id: 'x-007', name: 'Kolkata Bullion Association', city: 'Kolkata', state: 'West Bengal', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-008', name: 'Delhi Bullion & Jewellers Association', city: 'Delhi', state: 'Delhi', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.15 },
    { id: 'x-009', name: 'Jaipur Bullion Market', city: 'Jaipur', state: 'Rajasthan', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.08 },
    { id: 'x-010', name: 'Hyderabad Bullion Market', city: 'Hyderabad', state: 'Telangana', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.05 },
    { id: 'x-011', name: 'Bengaluru Bullion Market', city: 'Bengaluru', state: 'Karnataka', country: 'India', currency: 'INR', metal: 'gold', basisPct: -0.02 },
    { id: 'x-012', name: 'Ahmedabad Bullion Association', city: 'Ahmedabad', state: 'Gujarat', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-013', name: 'Pune Bullion Market', city: 'Pune', state: 'Maharashtra', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.04 },
    { id: 'x-014', name: 'Nagpur Bullion Market', city: 'Nagpur', state: 'Maharashtra', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.06 },
    { id: 'x-015', name: 'Surat Bullion Market', city: 'Surat', state: 'Gujarat', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.09 },
    { id: 'x-016', name: 'Rajkot Bullion Market', city: 'Rajkot', state: 'Gujarat', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.07 },
    { id: 'x-017', name: 'Coimbatore Bullion Market', city: 'Coimbatore', state: 'Tamil Nadu', country: 'India', currency: 'INR', metal: 'gold', basisPct: -0.04 },
    { id: 'x-018', name: 'Madurai Bullion Market', city: 'Madurai', state: 'Tamil Nadu', country: 'India', currency: 'INR', metal: 'gold', basisPct: -0.03 },
    { id: 'x-019', name: 'Trichy Bullion Market', city: 'Tiruchirappalli', state: 'Tamil Nadu', country: 'India', currency: 'INR', metal: 'gold', basisPct: -0.02 },
    { id: 'x-020', name: 'Kochi Bullion Market', city: 'Kochi', state: 'Kerala', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.05 },
    { id: 'x-021', name: 'Bhubaneswar Bullion Market', city: 'Bhubaneswar', state: 'Odisha', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.03 },
    { id: 'x-022', name: 'Patna Bullion Market', city: 'Patna', state: 'Bihar', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.07 },
    { id: 'x-023', name: 'Lucknow Bullion Market', city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.09 },
    { id: 'x-024', name: 'Kanpur Bullion Market', city: 'Kanpur', state: 'Uttar Pradesh', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.06 },
    { id: 'x-025', name: 'Indore Bullion Market', city: 'Indore', state: 'Madhya Pradesh', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.08 },
    { id: 'x-026', name: 'Bhopal Bullion Market', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.05 },
    { id: 'x-027', name: 'Guwahati Bullion Market', city: 'Guwahati', state: 'Assam', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-028', name: 'Visakhapatnam Bullion Market', city: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.04 },
    { id: 'x-029', name: 'Vijayawada Bullion Market', city: 'Vijayawada', state: 'Andhra Pradesh', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.05 },
    { id: 'x-030', name: 'Goa Bullion Market', city: 'Panaji', state: 'Goa', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.09 },
    { id: 'x-031', name: 'Pondicherry Bullion Market', city: 'Puducherry', state: 'Puducherry', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.06 },
    { id: 'x-032', name: 'Thrissur Bullion Market', city: 'Thrissur', state: 'Kerala', country: 'India', currency: 'INR', metal: 'gold', basisPct: 0.03 },
    { id: 'x-033', name: 'ICEX', city: 'Mumbai', state: 'Maharashtra', country: 'India', currency: 'INR', metal: 'both', basisPct: 0.10 },
    { id: 'x-034', name: 'LBMA', city: 'London', state: 'England', country: 'United Kingdom', currency: 'GBP', metal: 'both', basisPct: 0.10 },
    { id: 'x-035', name: 'COMEX', city: 'New York', state: 'NY', country: 'USA', currency: 'USD', metal: 'both', basisPct: -0.05 },
    { id: 'x-036', name: 'NYMEX', city: 'New York', state: 'NY', country: 'USA', currency: 'USD', metal: 'both', basisPct: 0.00 },
    { id: 'x-037', name: 'Shanghai Gold Exchange', city: 'Shanghai', state: 'Shanghai', country: 'China', currency: 'CNY', metal: 'gold', basisPct: 0.30 },
    { id: 'x-038', name: 'Shanghai Futures Exchange', city: 'Shanghai', state: 'Shanghai', country: 'China', currency: 'CNY', metal: 'both', basisPct: 0.20 },
    { id: 'x-039', name: 'Tokyo Commodity Exchange (TOCOM)', city: 'Tokyo', state: 'Tokyo', country: 'Japan', currency: 'JPY', metal: 'both', basisPct: 0.15 },
    { id: 'x-040', name: 'Hong Kong Gold & Silver Exchange', city: 'Hong Kong', state: 'Hong Kong', country: 'Hong Kong', currency: 'HKD', metal: 'both', basisPct: 0.25 },
    { id: 'x-041', name: 'Dubai Gold & Commodities Exchange', city: 'Dubai', state: 'Dubai', country: 'UAE', currency: 'AED', metal: 'both', basisPct: 0.10 },
    { id: 'x-042', name: 'Dubai Gold & Jewellery Group', city: 'Dubai', state: 'Dubai', country: 'UAE', currency: 'AED', metal: 'gold', basisPct: 0.05 },
    { id: 'x-043', name: 'Singapore Bullion Market Association', city: 'Singapore', state: 'Singapore', country: 'Singapore', currency: 'SGD', metal: 'both', basisPct: 0.15 },
    { id: 'x-044', name: 'Borsa Istanbul', city: 'Istanbul', state: 'Istanbul', country: 'Türkiye', currency: 'TRY', metal: 'both', basisPct: 0.45 },
    { id: 'x-045', name: 'Johannesburg Bullion Market', city: 'Johannesburg', state: 'Gauteng', country: 'South Africa', currency: 'ZAR', metal: 'gold', basisPct: 0.20 },
    { id: 'x-046', name: 'Sydney Bullion Market', city: 'Sydney', state: 'NSW', country: 'Australia', currency: 'AUD', metal: 'both', basisPct: 0.20 },
    { id: 'x-047', name: 'Toronto Bullion Market', city: 'Toronto', state: 'Ontario', country: 'Canada', currency: 'CAD', metal: 'both', basisPct: 0.15 },
    { id: 'x-048', name: 'Bangkok Gold Exchange', city: 'Bangkok', state: 'Bangkok', country: 'Thailand', currency: 'THB', metal: 'both', basisPct: 0.35 },
    { id: 'x-049', name: 'Kuala Lumpur Bullion Market', city: 'Kuala Lumpur', state: 'Kuala Lumpur', country: 'Malaysia', currency: 'MYR', metal: 'both', basisPct: 0.30 },
    { id: 'x-050', name: 'Jakarta Bullion Market', city: 'Jakarta', state: 'Jakarta', country: 'Indonesia', currency: 'IDR', metal: 'gold', basisPct: 0.40 },
    { id: 'x-051', name: 'Manila Bullion Market', city: 'Manila', state: 'Metro Manila', country: 'Philippines', currency: 'PHP', metal: 'gold', basisPct: 0.40 },
    { id: 'x-052', name: 'Colombo Gold Market', city: 'Colombo', state: 'Western', country: 'Sri Lanka', currency: 'LKR', metal: 'gold', basisPct: 0.45 },
    { id: 'x-053', name: 'Kathmandu Gold Market', city: 'Kathmandu', state: 'Bagmati', country: 'Nepal', currency: 'NPR', metal: 'gold', basisPct: 0.50 },
    { id: 'x-054', name: 'Dhaka Bullion Market', city: 'Dhaka', state: 'Dhaka', country: 'Bangladesh', currency: 'BDT', metal: 'gold', basisPct: 0.55 },
    { id: 'x-055', name: 'Karachi Bullion Market', city: 'Karachi', state: 'Sindh', country: 'Pakistan', currency: 'PKR', metal: 'gold', basisPct: 0.60 },
    { id: 'x-056', name: 'Lahore Bullion Market', city: 'Lahore', state: 'Punjab', country: 'Pakistan', currency: 'PKR', metal: 'gold', basisPct: 0.55 },
    { id: 'x-057', name: 'Tehran Bullion Market', city: 'Tehran', state: 'Tehran', country: 'Iran', currency: 'IRR', metal: 'gold', basisPct: 1.20 },
    { id: 'x-058', name: 'Tel Aviv Bullion Market', city: 'Tel Aviv', state: 'Tel Aviv', country: 'Israel', currency: 'ILS', metal: 'gold', basisPct: 0.25 },
    { id: 'x-059', name: 'Moscow Exchange', city: 'Moscow', state: 'Moscow', country: 'Russia', currency: 'RUB', metal: 'both', basisPct: 0.30 },
    { id: 'x-060', name: 'São Paulo Bullion Market', city: 'São Paulo', state: 'São Paulo', country: 'Brazil', currency: 'BRL', metal: 'gold', basisPct: 0.50 },
    { id: 'x-061', name: 'Mexico City Bullion Market', city: 'Mexico City', state: 'CDMX', country: 'Mexico', currency: 'MXN', metal: 'gold', basisPct: 0.40 },
    { id: 'x-062', name: 'Buenos Aires Bullion Market', city: 'Buenos Aires', state: 'Buenos Aires', country: 'Argentina', currency: 'ARS', metal: 'gold', basisPct: 0.70 },
    { id: 'x-063', name: 'Lima Bullion Market', city: 'Lima', state: 'Lima', country: 'Peru', currency: 'PEN', metal: 'gold', basisPct: 0.35 },
    { id: 'x-064', name: 'Santiago Bullion Market', city: 'Santiago', state: 'Santiago', country: 'Chile', currency: 'CLP', metal: 'gold', basisPct: 0.30 },
    { id: 'x-065', name: 'Bogotá Bullion Market', city: 'Bogotá', state: 'Bogotá', country: 'Colombia', currency: 'COP', metal: 'gold', basisPct: 0.35 },
    { id: 'x-066', name: 'Vancouver Bullion Market', city: 'Vancouver', state: 'British Columbia', country: 'Canada', currency: 'CAD', metal: 'gold', basisPct: 0.15 },
    { id: 'x-067', name: 'Melbourne Bullion Market', city: 'Melbourne', state: 'Victoria', country: 'Australia', currency: 'AUD', metal: 'gold', basisPct: 0.20 },
    { id: 'x-068', name: 'Auckland Bullion Market', city: 'Auckland', state: 'Auckland', country: 'New Zealand', currency: 'NZD', metal: 'gold', basisPct: 0.25 },
    { id: 'x-069', name: 'Seoul Bullion Market', city: 'Seoul', state: 'Seoul', country: 'South Korea', currency: 'KRW', metal: 'gold', basisPct: 0.30 },
    { id: 'x-070', name: 'Taipei Bullion Market', city: 'Taipei', state: 'Taipei', country: 'Taiwan', currency: 'TWD', metal: 'gold', basisPct: 0.30 },
    { id: 'x-071', name: 'Zurich Bullion Market', city: 'Zurich', state: 'Zürich', country: 'Switzerland', currency: 'CHF', metal: 'gold', basisPct: 0.10 },
    { id: 'x-072', name: 'Frankfurt Bullion Market', city: 'Frankfurt', state: 'Hesse', country: 'Germany', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-073', name: 'Paris Bullion Market', city: 'Paris', state: 'Île-de-France', country: 'France', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-074', name: 'Milan Bullion Market', city: 'Milan', state: 'Lombardy', country: 'Italy', currency: 'EUR', metal: 'gold', basisPct: 0.12 },
    { id: 'x-075', name: 'Madrid Bullion Market', city: 'Madrid', state: 'Madrid', country: 'Spain', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-076', name: 'Amsterdam Bullion Market', city: 'Amsterdam', state: 'North Holland', country: 'Netherlands', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-077', name: 'Brussels Bullion Market', city: 'Brussels', state: 'Brussels', country: 'Belgium', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-078', name: 'Copenhagen Bullion Market', city: 'Copenhagen', state: 'Capital Region', country: 'Denmark', currency: 'DKK', metal: 'gold', basisPct: 0.10 },
    { id: 'x-079', name: 'Stockholm Bullion Market', city: 'Stockholm', state: 'Stockholm', country: 'Sweden', currency: 'SEK', metal: 'gold', basisPct: 0.10 },
    { id: 'x-080', name: 'Oslo Bullion Market', city: 'Oslo', state: 'Oslo', country: 'Norway', currency: 'NOK', metal: 'gold', basisPct: 0.10 },
    { id: 'x-081', name: 'Helsinki Bullion Market', city: 'Helsinki', state: 'Uusimaa', country: 'Finland', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-082', name: 'Warsaw Bullion Market', city: 'Warsaw', state: 'Masovia', country: 'Poland', currency: 'PLN', metal: 'gold', basisPct: 0.15 },
    { id: 'x-083', name: 'Prague Bullion Market', city: 'Prague', state: 'Prague', country: 'Czechia', currency: 'CZK', metal: 'gold', basisPct: 0.12 },
    { id: 'x-084', name: 'Budapest Bullion Market', city: 'Budapest', state: 'Budapest', country: 'Hungary', currency: 'HUF', metal: 'gold', basisPct: 0.18 },
    { id: 'x-085', name: 'Vienna Bullion Market', city: 'Vienna', state: 'Vienna', country: 'Austria', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-086', name: 'Lisbon Bullion Market', city: 'Lisbon', state: 'Lisbon', country: 'Portugal', currency: 'EUR', metal: 'gold', basisPct: 0.10 },
    { id: 'x-087', name: 'Cape Town Bullion Market', city: 'Cape Town', state: 'Western Cape', country: 'South Africa', currency: 'ZAR', metal: 'gold', basisPct: 0.20 },
    { id: 'x-088', name: 'Lagos Bullion Market', city: 'Lagos', state: 'Lagos', country: 'Nigeria', currency: 'NGN', metal: 'gold', basisPct: 0.60 },
    { id: 'x-089', name: 'Nairobi Bullion Market', city: 'Nairobi', state: 'Nairobi', country: 'Kenya', currency: 'KES', metal: 'gold', basisPct: 0.55 },
    { id: 'x-090', name: 'Cairo Bullion Market', city: 'Cairo', state: 'Cairo', country: 'Egypt', currency: 'EGP', metal: 'gold', basisPct: 0.50 },
    { id: 'x-091', name: 'Muscat Bullion Market', city: 'Muscat', state: 'Muscat', country: 'Oman', currency: 'OMR', metal: 'gold', basisPct: 0.08 },
    { id: 'x-092', name: 'Doha Bullion Market', city: 'Doha', state: 'Doha', country: 'Qatar', currency: 'QAR', metal: 'gold', basisPct: 0.08 },
    { id: 'x-093', name: 'Kuwait City Bullion Market', city: 'Kuwait City', state: 'Al Asimah', country: 'Kuwait', currency: 'KWD', metal: 'gold', basisPct: 0.05 },
    { id: 'x-094', name: 'Manama Bullion Market', city: 'Manama', state: 'Al Manamah', country: 'Bahrain', currency: 'BHD', metal: 'gold', basisPct: 0.05 },
    { id: 'x-095', name: 'Beirut Bullion Market', city: 'Beirut', state: 'Beirut', country: 'Lebanon', currency: 'LBP', metal: 'gold', basisPct: 1.50 },
    { id: 'x-096', name: 'Amman Bullion Market', city: 'Amman', state: 'Amman', country: 'Jordan', currency: 'JOD', metal: 'gold', basisPct: 0.20 },
    { id: 'x-097', name: 'Kyiv Bullion Market', city: 'Kyiv', state: 'Kyiv', country: 'Ukraine', currency: 'UAH', metal: 'gold', basisPct: 0.40 },
    { id: 'x-098', name: 'Bucharest Bullion Market', city: 'Bucharest', state: 'Bucharest', country: 'Romania', currency: 'RON', metal: 'gold', basisPct: 0.15 },
    { id: 'x-099', name: 'Sofia Bullion Market', city: 'Sofia', state: 'Sofia', country: 'Bulgaria', currency: 'BGN', metal: 'gold', basisPct: 0.12 },
    { id: 'x-100', name: 'Athens Bullion Market', city: 'Athens', state: 'Attica', country: 'Greece', currency: 'EUR', metal: 'gold', basisPct: 0.10 }
  ];

  function parseSwissquoteMid(json) {
    if (!Array.isArray(json)) return NaN;
    for (const item of json) {
      const list = item && item.spreadProfilePrices;
      if (Array.isArray(list)) {
        for (const row of list) {
          const bid = Number(row && row.bid);
          const ask = Number(row && row.ask);
          if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) return (bid + ask) / 2;
        }
      }
    }
    return NaN;
  }

  const GOLD_TIERS = [
    [
      { name: 'Swissquote', url: 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', parse: parseSwissquoteMid },
      { name: 'gold-api', url: 'https://api.gold-api.com/price/XAU', parse: (j) => Number(j && j.price) }
    ],
    [
      { name: 'jsDelivr', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json', parse: (j) => Number(j && j.xau && j.xau.usd) },
      { name: 'Cloudflare', url: 'https://latest.currency-api.pages.dev/v1/currencies/xau.json', parse: (j) => Number(j && j.xau && j.xau.usd) }
    ]
  ];

  const SILVER_TIERS = [
    [
      { name: 'Swissquote', url: 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/USD', parse: parseSwissquoteMid },
      { name: 'gold-api', url: 'https://api.gold-api.com/price/XAG', parse: (j) => Number(j && j.price) }
    ],
    [
      { name: 'jsDelivr', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xag.json', parse: (j) => Number(j && j.xag && j.xag.usd) },
      { name: 'Cloudflare', url: 'https://latest.currency-api.pages.dev/v1/currencies/xag.json', parse: (j) => Number(j && j.xag && j.xag.usd) }
    ]
  ];

  const parseIsoDateAsOf = (d) => {
    const s = typeof d === 'string' ? d.trim() : '';
    if (!s) return null;
    const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
    return Number.isFinite(t) ? t : null;
  };

  const FX_TIERS = [
    [
      {
        name: 'currency-converter.live',
        url: 'https://currency-converter.live/api/v1/cross?base=USD&symbols=INR',
        parse: (j) => Number(j && j.data && j.data.rates && j.data.rates.INR),
        parseAsOf: (j) => {
          const q = j && j.data && j.data.quotes && j.data.quotes.INR;
          return parseIsoDateAsOf((q && q.as_of) || (j && j.data && j.data.generated_at));
        },
        live: true
      },
      {
        name: 'fxapi.app',
        url: 'https://fxapi.app/api/USD/INR.json',
        parse: (j) => Number(j && j.rate),
        parseAsOf: (j) => parseIsoDateAsOf(j && j.timestamp),
        live: true
      }
    ],
    [
      {
        name: 'open.er-api',
        url: 'https://open.er-api.com/v6/latest/USD',
        parse: (j) => Number(j && j.rates && j.rates.INR),
        parseAsOf: (j) => {
          const unix = Number(j && j.time_last_update_unix);
          return Number.isFinite(unix) && unix > 0 ? unix * 1000 : parseIsoDateAsOf(j && j.time_last_update_utc);
        }
      }
    ],
    [
      {
        name: 'jsDelivr',
        url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
        parse: (j) => Number(j && j.usd && j.usd.inr),
        parseAsOf: (j) => parseIsoDateAsOf(j && j.date)
      },
      {
        name: 'Cloudflare',
        url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
        parse: (j) => Number(j && j.usd && j.usd.inr),
        parseAsOf: (j) => parseIsoDateAsOf(j && j.date)
      }
    ],
    [
      {
        name: 'Frankfurter',
        url: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR',
        parse: (j) => Number(j && j.rates && j.rates.INR),
        parseAsOf: (j) => parseIsoDateAsOf(j && j.date)
      }
    ]
  ];

  const ACCURACY_LIVE_FEEDS = [
    { id: 'a-1', name: 'Binance', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'gold', url: 'https://api.binance.com/api/v3/ticker/bookTicker?symbol=XAUUSDT', parse: (j) => (Number(j && j.bidPrice) + Number(j && j.askPrice)) / 2 },
    { id: 'a-2', name: 'Binance', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'silver', url: 'https://api.binance.com/api/v3/ticker/bookTicker?symbol=XAGUSDT', parse: (j) => (Number(j && j.bidPrice) + Number(j && j.askPrice)) / 2 },
    { id: 'a-3', name: 'OKX', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'gold', url: 'https://www.okx.com/api/v5/market/ticker?instId=XAU-USDT-SWAP', parse: (j) => (Number(j && j.data && j.data[0] && j.data[0].bidPx) + Number(j && j.data && j.data[0] && j.data[0].askPx)) / 2 },
    { id: 'a-4', name: 'OKX', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'silver', url: 'https://www.okx.com/api/v5/market/ticker?instId=XAG-USDT-SWAP', parse: (j) => (Number(j && j.data && j.data[0] && j.data[0].bidPx) + Number(j && j.data && j.data[0] && j.data[0].askPx)) / 2 },
    { id: 'a-5', name: 'Bybit', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'gold', url: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=XAUUSDT', parse: (j) => (Number(j && j.result && j.result.list && j.result.list[0] && j.result.list[0].bid1Price) + Number(j && j.result && j.result.list && j.result.list[0] && j.result.list[0].ask1Price)) / 2 },
    { id: 'a-6', name: 'Coinbase', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'gold', url: 'https://api.coinbase.com/v2/prices/XAU-USD/spot', parse: (j) => Number(j && j.data && j.data.amount) },
    { id: 'a-7', name: 'Gold-API', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'gold', url: 'https://api.gold-api.com/price/XAU', parse: (j) => Number(j && j.price) },
    { id: 'a-8', name: 'Gold-API', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'silver', url: 'https://api.gold-api.com/price/XAG', parse: (j) => Number(j && j.price) },
    { id: 'a-9', name: 'Swissquote', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'gold', url: 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', parse: parseSwissquoteMid },
    { id: 'a-10', name: 'Swissquote', city: 'Global', country: 'Worldwide', currency: 'USD', metal: 'silver', url: 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/USD', parse: parseSwissquoteMid }
  ];

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    activeView: 'desk',
    activeSubtab: 'calc',
    cityId: 'cuttack',
    marketMode: 'INR',
    exCalcMetal: 'gold',
    statutory: null,
    statutoryRaw: null,
    prices: null,
    prevPrices: null,
    admin: {
      unlocked: false,
      offlineSession: false,
      token: '',
      login: '',
      busy: false,
      publishedItems: [],
      localItems: [],
      pendingFiles: [],
      objectUrls: [],
      lightboxObjectUrls: [],
      filter: 'all',
      search: '',
      sort: 'new',
      lightboxItem: null,
      lightboxIdx: 0,
      tagItem: null
    },
    bill: {
      docType: 'GST Estimate',
      billNo: '',
      customerName: '',
      customerPhone: '',
      lines: [],
      oldExchange: 0,
      discount: 0,
      advance: 0,
      notes: '',
      includeGst: true
    },
    orders: {
      items: [],
      filter: 'active'
    },
    live: {
      connected: false,
      spotGold: null,
      spotSilver: null,
      usdInr: null,
      goldSource: '',
      fxSource: '',
      fxLive: false,
      usdInrAsOf: null,
      lastSync: null,
      cachedTs: null,
      lastFxSync: 0,
      lastFxAttempt: 0,
      fxInFlight: null,
      fxTimer: null,
      restTimer: null,
      wsSockets: [],
      wsWinner: '',
      wsConnected: false
    },
    exchanges: { metal: 'gold', sortBy: 'diff', search: '' },
    accuracy: {
      metal: 'gold',
      loading: false,
      feeds: [],
      consensus: null,
      consensusUsd: null,
      shopBase: null,
      variancePct: 0,
      liveCount: 0,
      lastFetch: null,
      calibPctGold: 0,
      calibPctSilver: 0
    },
    pwa: {
      deferredPrompt: null,
      swReg: null,
      waitingWorker: null
    }
  };

  // =========================================================================
  // PURE HELPERS: PRICING, VALIDATION, SANITIZATION, FORMATTING
  // =========================================================================
  const roundSpot = (v) => (Number.isFinite(v) ? Number(v.toFixed(4)) : NaN);
  const roundFxRate = (v) => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);

  function todayIstIso(date = new Date()) {
    try {
      const iso = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    } catch { /* fallback below */ }
    const ist = new Date(date.getTime() + 5.5 * 3600000);
    return ist.toISOString().slice(0, 10);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatIndianInt(n) {
    const neg = n < 0;
    const s = String(neg ? -n : Math.round(n));
    if (s.length <= 3) return neg ? `-${s}` : s;
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    let out = '';
    while (rest.length > 2) {
      out = `,${rest.slice(-2)}${out}`;
      rest = rest.slice(0, -2);
    }
    return `${neg ? '-' : ''}${rest}${out},${last3}`;
  }

  function fmtINR(val, decimals = 0) {
    if (!Number.isFinite(val)) return '₹--';
    if (decimals === 0) return `₹${formatIndianInt(Math.round(val))}`;
    const mult = Math.pow(10, decimals);
    const scaled = Math.round(val * mult);
    const neg = scaled < 0;
    const abs = Math.abs(scaled);
    const intPart = Math.floor(abs / mult);
    const fracPart = String(abs % mult).padStart(decimals, '0');
    return `${neg ? '-₹' : '₹'}${formatIndianInt(intPart)}.${fracPart}`;
  }

  function fmtUSD(val) {
    if (!Number.isFinite(val)) return '$--';
    const neg = val < 0;
    const abs = Math.abs(val).toFixed(2);
    const [intPart, dec] = abs.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${neg ? '-$' : '$'}${grouped}.${dec}`;
  }

  function fmtTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  function formatFileBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatRelativeAge(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    if (sec < 10) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    const rem = min % 60;
    return rem ? `${hr}h ${rem}m ago` : `${hr}h ago`;
  }

  function spotInBand(value, metal) {
    const band = SPOT_BANDS[metal === 'silver' ? 'silver' : 'gold'];
    const n = Number(value);
    return Number.isFinite(n) && n >= band.min && n <= band.max;
  }

  function acceptSpot(value, metal, prev) {
    if (!spotInBand(value, metal)) return { ok: false, reason: 'band', value: Number(value) };
    const n = Number(value);
    const p = Number(prev);
    if (Number.isFinite(p) && p > 0 && Math.abs(n - p) / p > MAX_SPOT_MOVE_PCT) {
      return { ok: false, reason: 'move', value: n };
    }
    return { ok: true, value: roundSpot(n) };
  }

  function validateUsdInr(v, prev) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: 'value' };
    if (n < USD_INR_MIN || n > USD_INR_MAX) return { ok: false, reason: 'band' };
    const p = Number(prev);
    if (Number.isFinite(p) && p > 0 && Math.abs(n - p) / p > USD_INR_MAX_MOVE_PCT) {
      return { ok: false, reason: 'move' };
    }
    return { ok: true, value: n };
  }

  function statutoryRatesFor(metal, overrideStatutory = null) {
    const key = metal === 'silver' ? 'silver' : 'gold';
    const fallback = DEFAULT_STATUTORY_RATES[key];
    const src = overrideStatutory || state.statutory;
    const found = src && src[key] ? src[key] : null;
    const duty = found ? Number(found.importDutyPct) : NaN;
    const gst = found ? Number(found.gstPct) : NaN;
    return {
      importDutyPct: Number.isFinite(duty) && duty > 0 && duty <= 60 ? duty : fallback.importDutyPct,
      gstPct: Number.isFinite(gst) && gst >= 0 && gst <= 30 ? gst : fallback.gstPct,
      effectiveFrom: (found && typeof found.effectiveFrom === 'string' && found.effectiveFrom) || fallback.effectiveFrom,
      verifiedOn: (found && typeof found.verifiedOn === 'string' && found.verifiedOn) || fallback.verifiedOn,
      note: (found && typeof found.note === 'string' && found.note) || fallback.note,
      sources: Array.isArray(found && found.sources) && found.sources.length ? found.sources : fallback.sources
    };
  }

  function importDutyMultiplier(metal, overrideStatutory = null) {
    return 1 + statutoryRatesFor(metal, overrideStatutory).importDutyPct / 100;
  }

  function gstMultiplier(metal, overrideStatutory = null) {
    return 1 + statutoryRatesFor(metal, overrideStatutory).gstPct / 100;
  }

  function statutoryLabel(metal, overrideStatutory = null) {
    const r = statutoryRatesFor(metal, overrideStatutory);
    return `${r.importDutyPct}% duty + ${r.gstPct}% GST`;
  }

  function statutoryIsStale(now = Date.now(), overrideStatutory = null) {
    const ts = Date.parse(`${statutoryRatesFor('gold', overrideStatutory).verifiedOn}T00:00:00Z`);
    return Number.isFinite(ts) ? (now - ts) > STATUTORY_REVIEW_DAYS * 86400000 : true;
  }

  function sanitizeStatutoryPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const metal of ['gold', 'silver']) {
      const m = raw[metal];
      if (!m || typeof m !== 'object') return null;
      const duty = Number(m.importDutyPct);
      const gst = Number(m.gstPct);
      if (!Number.isFinite(duty) || duty <= 0 || duty > 60) return null;
      if (!Number.isFinite(gst) || gst < 0 || gst > 30) return null;
      const eff = typeof m.effectiveFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.effectiveFrom) ? m.effectiveFrom : DEFAULT_STATUTORY_RATES[metal].effectiveFrom;
      const ver = typeof m.verifiedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.verifiedOn) ? m.verifiedOn : DEFAULT_STATUTORY_RATES[metal].verifiedOn;
      out[metal] = {
        importDutyPct: Number(duty.toFixed(4)),
        gstPct: Number(gst.toFixed(4)),
        effectiveFrom: eff,
        verifiedOn: ver,
        note: typeof m.note === 'string' ? m.note.trim().slice(0, 220) : '',
        sources: Array.isArray(m.sources) ? m.sources.filter((s) => typeof s === 'string' && /^https:\/\//.test(s)) : DEFAULT_STATUTORY_RATES[metal].sources
      };
    }
    return out;
  }

  function validateStatutoryDraft(draft) {
    const errors = [];
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const metal of ['gold', 'silver']) {
      const m = draft && draft[metal];
      if (!m) { errors.push(`Missing ${metal} rates.`); continue; }
      const duty = Number(m.importDutyPct);
      const gst = Number(m.gstPct);
      if (!Number.isFinite(duty) || duty <= 0 || duty > 60) errors.push(`${metal.toUpperCase()} import duty must be between 0.1% and 60%.`);
      if (!Number.isFinite(gst) || gst < 0 || gst > 30) errors.push(`${metal.toUpperCase()} GST must be between 0% and 30%.`);
      if (!dateRe.test(String(m.effectiveFrom || ''))) errors.push(`${metal.toUpperCase()} effective date must be YYYY-MM-DD.`);
      if (!dateRe.test(String(m.verifiedOn || ''))) errors.push(`${metal.toUpperCase()} verified date must be YYYY-MM-DD.`);
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, payload: sanitizeStatutoryPayload(draft) };
  }

  function computeCityPrices(cityId, spotGold, spotSilver, usdInr, opts = {}) {
    const city = CITIES[cityId] || CITIES.cuttack;
    const calGold = 1 + (Number(opts.calibPctGold != null ? opts.calibPctGold : state.accuracy.calibPctGold) || 0) / 100;
    const calSilver = 1 + (Number(opts.calibPctSilver != null ? opts.calibPctSilver : state.accuracy.calibPctSilver) || 0) / 100;
    const effGold = spotGold * calGold;
    const effSilver = spotSilver * calSilver;
    const goldDuty = importDutyMultiplier('gold', opts.statutory);
    const silverDuty = importDutyMultiplier('silver', opts.statutory);
    const goldGst = gstMultiplier('gold', opts.statutory);
    const silverGst = gstMultiplier('silver', opts.statutory);

    const goldPerGramLanded = ((effGold * usdInr) / TROY_OZ_TO_GRAMS) * goldDuty;
    const silverPerGramLanded = ((effSilver * usdInr) / TROY_OZ_TO_GRAMS) * silverDuty;

    const gold24ExGstRaw = goldPerGramLanded * 10 * city.factor;
    const gold24GstRaw = gold24ExGstRaw * goldGst;
    const silverMCXRaw = silverPerGramLanded * 1000;
    const silverMCXGstRaw = silverMCXRaw * silverGst;
    const silver999ExGstRaw = silverMCXRaw * city.factor;
    const silver999GstRaw = silver999ExGstRaw * silverGst;

    return {
      spotGold: effGold,
      spotSilver: effSilver,
      usdInr,
      gold999ExGst: Math.round(gold24ExGstRaw),
      gold995ExGst: Math.round(gold24ExGstRaw * (995 / 999)),
      gold916ExGst: Math.round(gold24ExGstRaw * (916 / 999)),
      gold18ExGst: Math.round(gold24ExGstRaw * (750 / 999)),
      gold999: Math.round(gold24GstRaw),
      gold995: Math.round(gold24GstRaw * (995 / 999)),
      gold916: Math.round(gold24GstRaw * (916 / 999)),
      gold18: Math.round(gold24GstRaw * (750 / 999)),
      gold999Gram: gold24GstRaw / 10,
      gold995Gram: (gold24GstRaw * (995 / 999)) / 10,
      gold916Gram: (gold24GstRaw * (916 / 999)) / 10,
      gold18Gram: (gold24GstRaw * (750 / 999)) / 10,
      gold999ExGstGram: gold24ExGstRaw / 10,
      gold995ExGstGram: (gold24ExGstRaw * (995 / 999)) / 10,
      gold916ExGstGram: (gold24ExGstRaw * (916 / 999)) / 10,
      gold18ExGstGram: (gold24ExGstRaw * (750 / 999)) / 10,
      silverMCX: Math.round(silverMCXRaw),
      silverMCXGst: Math.round(silverMCXGstRaw),
      silver999ExGst: Math.round(silver999ExGstRaw),
      silver925ExGst: Math.round(silver999ExGstRaw * (925 / 999)),
      silver750ExGst: Math.round(silver999ExGstRaw * (750 / 999)),
      silver999: Math.round(silver999GstRaw),
      silver925: Math.round(silver999GstRaw * (925 / 999)),
      silver750: Math.round(silver999GstRaw * (750 / 999)),
      silver999Gram: silver999GstRaw / 1000,
      silver925Gram: (silver999GstRaw * (925 / 999)) / 1000,
      silver750Gram: (silver999GstRaw * (750 / 999)) / 1000,
      silver999ExGstGram: silver999ExGstRaw / 1000,
      silver925ExGstGram: (silver999ExGstRaw * (925 / 999)) / 1000,
      silver750ExGstGram: (silver999ExGstRaw * (750 / 999)) / 1000
    };
  }

  function sanitizeCatalogMediaUrl(src) {
    const trimmed = String(src || '').trim();
    if (!trimmed) return '';
    if (/^catalog\/media\/[a-zA-Z0-9._-]+$/.test(trimmed)) return trimmed;
    if (/^blob:https?:\/\//.test(trimmed)) return trimmed;
    return '';
  }

  // Convert canonical repo path (`catalog/media/...`) into admin-page-relative display path (`../catalog/media/...`).
  function toAdminMediaSrc(src) {
    const safe = sanitizeCatalogMediaUrl(src);
    if (!safe) return '';
    return safe.startsWith('catalog/media/') ? `../${safe}` : safe;
  }

  function mediaExtFromFile(file) {
    const mime = String((file && file.type) || '').toLowerCase();
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/gif') return 'gif';
    if (mime === 'video/webm') return 'webm';
    if (mime === 'video/quicktime') return 'mov';
    if (mime === 'video/mp4') return 'mp4';
    return 'jpg';
  }

  function computeExchangeRows(prices = state.prices, filterMetal = state.exchanges.metal, sortBy = state.exchanges.sortBy, overrideStatutory = null) {
    if (!prices || !Number.isFinite(prices.spotGold) || !Number.isFinite(prices.spotSilver) || !Number.isFinite(prices.usdInr)) return null;
    const mode = filterMetal === 'silver' || filterMetal === 'both' ? filterMetal : 'gold';
    const metal = mode === 'silver' ? 'silver' : 'gold';
    const usdInr = prices.usdInr;
    const shopBase = metal === 'silver' ? prices.silver999ExGst : prices.gold999ExGst;
    const rows = [];

    for (const m of EXCHANGE_MARKETS) {
      if (m.isShop) continue;
      if (mode !== 'both' && m.metal !== 'both' && m.metal !== mode) continue;
      const quoteMetal = metal;
      const base = quoteMetal === 'gold' ? prices.gold999ExGst : prices.silver999ExGst;
      const cpu = CURRENCY_PER_USD[m.currency] || 1;
      const inrPerUnit = usdInr / cpu;
      const premium = 1 + m.basisPct / 100;
      const duty = importDutyMultiplier(quoteMetal, overrideStatutory);
      let theirInr;
      let local;
      if (quoteMetal === 'gold') {
        const usdPerGram = (prices.spotGold / TROY_OZ_TO_GRAMS) * premium;
        theirInr = usdPerGram * cpu * inrPerUnit * 10 * duty;
        local = m.currency === 'INR' ? theirInr / 10 : usdPerGram * cpu;
      } else {
        const usdPerKg = (prices.spotSilver / TROY_OZ_TO_GRAMS) * 1000 * premium;
        theirInr = usdPerKg * cpu * inrPerUnit * duty;
        local = m.currency === 'INR' ? theirInr : usdPerKg * cpu;
      }
      const diffAmt = theirInr - base;
      rows.push({ ...m, quoteMetal, theirInr, local, diffAmt, diffPct: base > 0 ? (diffAmt / base) * 100 : 0 });
    }

    rows.sort(sortBy === 'az'
      ? (a, b) => a.name.localeCompare(b.name)
      : (a, b) => Math.abs(a.diffPct) - Math.abs(b.diffPct) || a.name.localeCompare(b.name));

    rows.unshift({
      id: 'x-sj', name: 'Satyanarayan Jewellers', city: 'Cuttack', state: 'Odisha', country: 'India',
      currency: 'INR', metal, quoteMetal: metal, basisPct: 0, isShop: true,
      theirInr: shopBase,
      local: metal === 'gold' ? shopBase / 10 : shopBase,
      diffAmt: 0, diffPct: 0
    });
    return rows;
  }

  function unitToGrams(weight, unit) {
    const w = Math.max(0, Number(weight) || 0);
    if (unit === '10g') return w * 10;
    if (unit === 'kg') return w * 1000;
    if (unit === 'oz') return w * TROY_OZ_TO_GRAMS;
    return w;
  }

  function computeQuoteMath({ metal, weight, unit, makingVal, makingType, includeGst }, prices = state.prices, overrideStatutory = null) {
    if (!prices) return null;
    const perGramMap = {
      '24K': prices.gold999ExGstGram,
      '995': prices.gold995ExGstGram,
      '22K': prices.gold916ExGstGram,
      '18K': prices.gold18ExGstGram,
      S999: prices.silver999ExGstGram,
      S925: prices.silver925ExGstGram
    };
    const isSilver = metal === 'S999' || metal === 'S925';
    const grams = unitToGrams(weight, unit);
    const perGram = perGramMap[metal] || prices.gold916ExGstGram;
    const baseValue = Math.round(grams * perGram);
    const mv = Math.max(0, Number(makingVal) || 0);
    let makingCharges = 0;
    let makingLabel = `${mv}%`;
    if (makingType === 'per_g') {
      makingCharges = Math.round(grams * mv);
      makingLabel = `${fmtINR(mv, 0)}/g`;
    } else if (makingType === 'flat') {
      makingCharges = Math.round(mv);
      makingLabel = `${fmtINR(mv, 0)} flat`;
    } else {
      makingCharges = Math.round(baseValue * (mv / 100));
      makingLabel = `${mv}%`;
    }
    const gstPct = statutoryRatesFor(isSilver ? 'silver' : 'gold', overrideStatutory).gstPct;
    const gstAmount = includeGst ? Math.round((baseValue + makingCharges) * (gstPct / 100)) : 0;
    const grandTotal = baseValue + makingCharges + gstAmount;
    return { grams, baseValue, makingCharges, makingLabel, gstPct, gstAmount, grandTotal };
  }

  function computeOldExchangeMath({ metal, purity, weight, stone, hallmarked, newBill }, prices = state.prices) {
    if (!prices) return null;
    const grossGrams = Math.max(0, Number(weight) || 0);
    const stoneGrams = Math.min(grossGrams, Math.max(0, Number(stone) || 0));
    const netGrams = Math.max(0, grossGrams - stoneGrams);
    const pur = Math.min(100, Math.max(0, Number(purity) || 0));
    const finePerGram = metal === 'silver' ? prices.silver999ExGstGram : prices.gold999ExGstGram;
    const grossValue = netGrams * finePerGram * (pur / 99.9);
    const deductPct = hallmarked ? 0 : 30;
    const deductAmount = grossValue * (deductPct / 100);
    const netValue = grossValue - deductAmount;
    const bill = Number(newBill);
    const hasBill = Number.isFinite(bill) && bill > 0;
    return {
      netGrams,
      grossValue,
      deductPct,
      deductAmount,
      netValue,
      hasBill,
      balance: hasBill ? bill - netValue : 0
    };
  }

  function buildRatesShareText(prices = state.prices, cityId = state.cityId, overrideStatutory = null) {
    if (!prices) return '';
    const city = CITIES[cityId] || CITIES.cuttack;
    const gGst = statutoryRatesFor('gold', overrideStatutory).gstPct;
    const sGst = statutoryRatesFor('silver', overrideStatutory).gstPct;
    const stamp = state.live.lastSync ? fmtTime(state.live.lastSync) : fmtTime(new Date());
    return [
      `Satyanarayan Jewellers — ${city.name}, ${city.state}`,
      `Live Bullion Rates (${stamp} IST · ${statutoryLabel('gold', overrideStatutory)})`,
      '',
      `Gold (per 10g, ex-GST / incl. ${gGst}% GST):`,
      `• 999 (24K): ${fmtINR(prices.gold999ExGst)} / ${fmtINR(prices.gold999)}`,
      `• 995 Fine: ${fmtINR(prices.gold995ExGst)} / ${fmtINR(prices.gold995)}`,
      `• 916 (22K): ${fmtINR(prices.gold916ExGst)} / ${fmtINR(prices.gold916)}`,
      `• 750 (18K): ${fmtINR(prices.gold18ExGst)} / ${fmtINR(prices.gold18)}`,
      '',
      `Silver (per kg, ex-GST / incl. ${sGst}% GST):`,
      `• 999 Fine: ${fmtINR(prices.silver999ExGst)} / ${fmtINR(prices.silver999)}`,
      `• 925 Sterling: ${fmtINR(prices.silver925ExGst)} / ${fmtINR(prices.silver925)}`,
      `• MCX estimate: ${fmtINR(prices.silverMCX)} / ${fmtINR(prices.silverMCXGst)}`,
      '',
      `Spot: XAU ${fmtUSD(prices.spotGold)}/oz · XAG ${fmtUSD(prices.spotSilver)}/oz · USD/INR ₹${Number(prices.usdInr).toFixed(2)}`,
      `GSTIN: ${SHOP_GSTIN} · Indicative estimates, making charges extra.`
    ].join('\n');
  }

  function median(vals) {
    const s = vals.slice().sort((a, b) => a - b);
    if (!s.length) return null;
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // =========================================================================
  // ADMIN SUITE PURE HELPERS: AUTO-PRICING, BILL SLIPS, ORDERS & QR SVG
  // =========================================================================
  function inferMetalCode(category = 'Gold', purity = '') {
    const cat = String(category || '').toLowerCase();
    const pur = String(purity || '').toUpperCase();
    if (cat === 'silver' || pur.includes('SILVER') || pur.includes('925') || pur.includes('S999') || pur.includes('S925')) {
      return pur.includes('925') ? 'S925' : 'S999';
    }
    if (pur.includes('24K') || pur.includes('999')) return '24K';
    if (pur.includes('995')) return '995';
    if (pur.includes('18K') || pur.includes('750')) return '18K';
    return '22K';
  }

  function normalizeStockStatus(val) {
    return val === 'made_to_order' || val === 'sold_out' ? val : 'in_stock';
  }

  function stockStatusLabel(val) {
    const norm = normalizeStockStatus(val);
    if (norm === 'made_to_order') return 'Made to Order';
    if (norm === 'sold_out') return 'Sold Out';
    return 'In Stock';
  }

  function computeAutoItemPrice({ category = 'Gold', purity = '', weight = 0, makingPct = 10, includeGst = true }, prices = state.prices, overrideStatutory = null) {
    const w = Math.max(0, Number(weight) || 0);
    if (!prices || !(w > 0)) return null;
    const metal = inferMetalCode(category, purity);
    const quote = computeQuoteMath({
      metal,
      weight: w,
      unit: 'g',
      makingVal: Math.max(0, Number(makingPct) || 0),
      makingType: 'pct',
      includeGst: includeGst !== false
    }, prices, overrideStatutory);
    return quote ? { ...quote, metal } : null;
  }

  function computeBillTotals(billDraft = {}, prices = state.prices, overrideStatutory = null) {
    const rawLines = Array.isArray(billDraft.lines) ? billDraft.lines : [];
    const includeGst = billDraft.includeGst !== false;
    const computedLines = rawLines.map((ln, idx) => {
      const metal = ['24K', '995', '22K', '18K', 'S999', 'S925'].includes(ln.metal) ? ln.metal : '22K';
      const isSilver = metal === 'S999' || metal === 'S925';
      const weight = Math.max(0, Number(ln.weight) || 0);
      const perGramMap = prices ? {
        '24K': prices.gold999ExGstGram,
        '995': prices.gold995ExGstGram,
        '22K': prices.gold916ExGstGram,
        '18K': prices.gold18ExGstGram,
        S999: prices.silver999ExGstGram,
        S925: prices.silver925ExGstGram
      } : {};
      const customRate = Number(ln.ratePerGram);
      const ratePerGram = Number.isFinite(customRate) && customRate > 0
        ? customRate
        : (Number(perGramMap[metal]) || 0);
      const metalValue = Math.round(weight * ratePerGram);
      const mv = Math.max(0, Number(ln.makingVal) || 0);
      const mt = ln.makingType === 'per_g' || ln.makingType === 'flat' ? ln.makingType : 'pct';
      let makingCharges = 0;
      let makingLabel = `${mv}%`;
      if (mt === 'per_g') {
        makingCharges = Math.round(weight * mv);
        makingLabel = `${fmtINR(mv)}/g`;
      } else if (mt === 'flat') {
        makingCharges = Math.round(mv);
        makingLabel = `${fmtINR(mv)} flat`;
      } else {
        makingCharges = Math.round(metalValue * (mv / 100));
      }
      const gstPct = statutoryRatesFor(isSilver ? 'silver' : 'gold', overrideStatutory).gstPct;
      const taxable = metalValue + makingCharges;
      const gstAmount = includeGst ? Math.round(taxable * (gstPct / 100)) : 0;
      return {
        id: ln.id || `line-${idx + 1}`,
        desc: String(ln.desc || 'Jewellery Item').trim().slice(0, 80),
        metal,
        huid: String(ln.huid || '').trim().toUpperCase().slice(0, 12),
        weight,
        ratePerGram,
        metalValue,
        makingVal: mv,
        makingType: mt,
        makingLabel,
        makingCharges,
        taxable,
        gstPct,
        gstAmount,
        lineTotal: taxable + gstAmount
      };
    });

    const totalWeight = computedLines.reduce((acc, l) => acc + l.weight, 0);
    const metalSubtotal = computedLines.reduce((acc, l) => acc + l.metalValue, 0);
    const makingSubtotal = computedLines.reduce((acc, l) => acc + l.makingCharges, 0);
    const discount = Math.min(metalSubtotal + makingSubtotal, Math.max(0, Math.round(Number(billDraft.discount) || 0)));
    const taxableValue = Math.max(0, metalSubtotal + makingSubtotal - discount);
    const rawGstTotal = computedLines.reduce((acc, l) => acc + l.gstAmount, 0);
    const effectiveGstPct = computedLines.length ? computedLines[0].gstPct : statutoryRatesFor('gold', overrideStatutory).gstPct;
    const gstTotal = includeGst
      ? (discount > 0 ? Math.round(taxableValue * (effectiveGstPct / 100)) : rawGstTotal)
      : 0;
    const cgst = Math.floor(gstTotal / 2);
    const sgst = gstTotal - cgst;
    const grossTotal = taxableValue + gstTotal;
    const oldExchange = Math.max(0, Math.round(Number(billDraft.oldExchange) || 0));
    const advance = Math.max(0, Math.round(Number(billDraft.advance) || 0));
    const netPayable = grossTotal - oldExchange - advance;

    return {
      lines: computedLines,
      totalWeight,
      metalSubtotal,
      makingSubtotal,
      discount,
      taxableValue,
      gstTotal,
      cgst,
      sgst,
      grossTotal,
      oldExchange,
      advance,
      netPayable
    };
  }

  function buildBillShareText(billDraft = {}, totals = null) {
    const t = totals || computeBillTotals(billDraft);
    const docType = String(billDraft.docType || 'GST Estimate').trim();
    const billNo = String(billDraft.billNo || 'SJ-EST').trim();
    const cust = String(billDraft.customerName || 'Walk-in Customer').trim();
    const dateStr = todayIstIso();
    const out = [
      `*SATYANARAYAN JEWELLERS* — Cuttack, Odisha`,
      `GSTIN: ${SHOP_GSTIN} · BIS Hallmarked Showroom`,
      `${docType} #${billNo} · Date: ${dateStr}`,
      `Customer: ${cust}${billDraft.customerPhone ? ` (${billDraft.customerPhone})` : ''}`,
      '--------------------------------'
    ];
    if (!t.lines.length) {
      out.push('(No jewellery items added yet)');
    } else {
      t.lines.forEach((ln, idx) => {
        const huidStr = ln.huid ? ` · HUID:${ln.huid}` : '';
        out.push(`${idx + 1}. ${ln.desc} [${ln.metal} · ${ln.weight.toFixed(3)}g${huidStr}]`);
        out.push(`   Metal ${fmtINR(ln.metalValue)} + Making (${ln.makingLabel}) ${fmtINR(ln.makingCharges)} = ${fmtINR(ln.taxable)}`);
      });
    }
    out.push('--------------------------------');
    out.push(`Taxable Subtotal: ${fmtINR(t.taxableValue)}`);
    if (t.discount > 0) out.push(`Special Discount: -${fmtINR(t.discount)}`);
    if (t.gstTotal > 0) out.push(`GST (CGST ${fmtINR(t.cgst)} + SGST ${fmtINR(t.sgst)}): +${fmtINR(t.gstTotal)}`);
    out.push(`Gross Bill Value: ${fmtINR(t.grossTotal)}`);
    if (t.oldExchange > 0) out.push(`Less Old Metal Exchange: -${fmtINR(t.oldExchange)}`);
    if (t.advance > 0) out.push(`Less Advance Received: -${fmtINR(t.advance)}`);
    out.push(t.netPayable >= 0 ? `*Net Balance Payable: ${fmtINR(t.netPayable)}*` : `*Net Refund Due: ${fmtINR(Math.abs(t.netPayable))}*`);
    if (billDraft.notes) out.push(`Note: ${String(billDraft.notes).trim()}`);
    return out.join('\n');
  }

  function sanitizeOrderRecord(raw = {}) {
    const name = String(raw.customerName || raw.name || '').trim().slice(0, 80);
    const item = String(raw.item || '').trim().slice(0, 120);
    if (!name || !item) return null;
    const statusAllowed = ['Booked', 'Karigar', 'Ready', 'Delivered'];
    const status = statusAllowed.includes(raw.status) ? raw.status : 'Booked';
    return {
      id: String(raw.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).replace(/[^a-zA-Z0-9_-]/g, ''),
      customerName: name,
      phone: String(raw.phone || '').replace(/[^\d+]/g, '').slice(0, 15),
      item,
      metal: ['24K', '22K', '18K', 'S999', 'S925'].includes(raw.metal) ? raw.metal : '22K',
      weight: Math.max(0, Number(raw.weight) || 0),
      lockedRate: Math.max(0, Number(raw.lockedRate) || 0),
      advance: Math.max(0, Math.round(Number(raw.advance) || 0)),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.dueDate || '')) ? String(raw.dueDate) : '',
      status,
      note: String(raw.note || '').trim().slice(0, 180),
      createdAt: raw.createdAt || new Date().toISOString()
    };
  }

  function buildOrderWhatsAppText(order) {
    if (!order) return '';
    const statusLine = order.status === 'Ready'
      ? 'Your custom jewellery order is *READY FOR PICKUP* at our Cuttack showroom.'
      : order.status === 'Delivered'
        ? 'Thank you for collecting your jewellery order from Satyanarayan Jewellers!'
        : `Order status update: *${order.status}*.`;
    const parts = [
      `Namaskar ${order.customerName},`,
      `Greetings from *Satyanarayan Jewellers (Cuttack)*!`,
      statusLine,
      '',
      `• Order Ref: ${order.id}`,
      `• Item: ${order.item} (${order.metal}${order.weight > 0 ? ` · ~${Number(order.weight).toFixed(2)}g` : ''})`,
      order.lockedRate > 0 ? `• Rate Locked: ${fmtINR(order.lockedRate)}/g` : '',
      order.advance > 0 ? `• Advance Received: ${fmtINR(order.advance)}` : '',
      order.dueDate ? `• Promised Date: ${order.dueDate}` : '',
      order.note ? `• Note: ${order.note}` : '',
      '',
      `GSTIN: ${SHOP_GSTIN} · Please visit or reply for any assistance.`
    ].filter(Boolean);
    return parts.join('\n');
  }

  function catalogItemsToCsv(items = []) {
    const cols = ['id', 'name', 'category', 'purity', 'weight_g', 'making_pct', 'price_inr', 'stock_status', 'featured', 'sku', 'note', 'created_at'];
    const escCsv = (val) => {
      let s = String(val == null ? '' : val).replace(/\r?\n/g, ' ');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = items.map((p) => [
      p.id || '',
      p.name || '',
      p.category || 'Gold',
      p.purity || '',
      Number(p.weight) || 0,
      Number(p.makingPct) || 0,
      Number(p.price) || 0,
      normalizeStockStatus(p.stockStatus),
      p.featured ? 'yes' : 'no',
      p.sku || '',
      p.note || '',
      p.createdAt || ''
    ].map(escCsv).join(','));
    return [cols.join(','), ...rows].join('\n');
  }

  // Self-contained ISO/IEC 18004 QR Code SVG generator (Versions 1-6, ECC Level L, Byte mode).
  // Zero external CDN or network requests — renders crisp scannable vector QR tags offline.
  const QR_GF_EXP = new Uint8Array(512);
  const QR_GF_LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      QR_GF_EXP[i] = x;
      QR_GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) QR_GF_EXP[i] = QR_GF_EXP[i - 255];
  })();

  function qrReedSolomon(data, ecLen) {
    let gen = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(gen.length + 1).fill(0);
      const root = QR_GF_EXP[i];
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= gen[j] ? QR_GF_EXP[QR_GF_LOG[gen[j]] + QR_GF_LOG[root]] : 0;
      }
      gen = next;
    }
    const rem = new Uint8Array(ecLen);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ rem[0];
      rem.copyWithin(0, 1);
      rem[ecLen - 1] = 0;
      if (factor) {
        const logF = QR_GF_LOG[factor];
        for (let j = 0; j < ecLen; j++) {
          if (gen[j + 1]) rem[j] ^= QR_GF_EXP[QR_GF_LOG[gen[j + 1]] + logF];
        }
      }
    }
    return rem;
  }

  function generateQrSvg(text, sizePx = 104) {
    const bytes = new TextEncoder().encode(String(text || '').slice(0, 130));
    // Version table (Level L): [version, dataCodewords, ecPerBlock, numBlocks, alignCenters]
    const VERSIONS = [
      [1, 19, 7, 1, []],
      [2, 34, 10, 1, [6, 18]],
      [3, 55, 15, 1, [6, 22]],
      [4, 80, 20, 1, [6, 26]],
      [5, 108, 26, 1, [6, 30]],
      [6, 136, 18, 2, [6, 34]]
    ];
    const spec = VERSIONS.find((v) => bytes.length + 2 <= v[1]) || VERSIONS[VERSIONS.length - 1];
    const [ver, totalDataCw, ecLen, blocks, align] = spec;
    const payload = bytes.slice(0, totalDataCw - 2);
    const bits = [];
    const pushBits = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pushBits(0b0100, 4);
    pushBits(payload.length, 8);
    for (const b of payload) pushBits(b, 8);
    const maxBits = totalDataCw * 8;
    for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const dataCw = new Uint8Array(totalDataCw);
    for (let i = 0; i < bits.length / 8; i++) {
      let v = 0;
      for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b];
      dataCw[i] = v;
    }
    for (let i = bits.length / 8, pad = 0; i < totalDataCw; i++, pad ^= 1) {
      dataCw[i] = pad ? 0x11 : 0xec;
    }

    const blockDataLen = Math.floor(totalDataCw / blocks);
    const dataBlocks = [];
    const ecBlocks = [];
    for (let b = 0; b < blocks; b++) {
      const slice = dataCw.subarray(b * blockDataLen, (b + 1) * blockDataLen);
      dataBlocks.push(slice);
      ecBlocks.push(qrReedSolomon(slice, ecLen));
    }
    const finalCw = [];
    for (let i = 0; i < blockDataLen; i++) for (let b = 0; b < blocks; b++) finalCw.push(dataBlocks[b][i]);
    for (let i = 0; i < ecLen; i++) for (let b = 0; b < blocks; b++) finalCw.push(ecBlocks[b][i]);

    const dim = ver * 4 + 17;
    const grid = Array.from({ length: dim }, () => new Uint8Array(dim));
    const used = Array.from({ length: dim }, () => new Uint8Array(dim));
    const setMod = (r, c, dark) => {
      if (r < 0 || c < 0 || r >= dim || c >= dim) return;
      grid[r][c] = dark ? 1 : 0;
      used[r][c] = 1;
    };
    const placeFinder = (tr, tc) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const onRing = r === 0 || r === 6 || c === 0 || c === 6;
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setMod(tr + r, tc + c, inOuter && (onRing || inCore));
        }
      }
    };
    placeFinder(0, 0);
    placeFinder(0, dim - 7);
    placeFinder(dim - 7, 0);

    for (let i = 8; i < dim - 8; i++) {
      if (!used[6][i]) setMod(6, i, i % 2 === 0);
      if (!used[i][6]) setMod(i, 6, i % 2 === 0);
    }
    for (const r of align) {
      for (const c of align) {
        if (used[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            setMod(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }
    // Reserve format areas + dark module
    for (let i = 0; i < 9; i++) {
      if (!used[8][i]) used[8][i] = 1;
      if (!used[i][8]) used[i][8] = 1;
    }
    for (let i = 0; i < 8; i++) {
      used[8][dim - 1 - i] = 1;
      used[dim - 1 - i][8] = 1;
    }
    setMod(dim - 8, 8, true);

    let bitIdx = 0;
    const totalBits = finalCw.length * 8;
    for (let right = dim - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((dim - 1 - right) >> 1) % 2 === 0;
      for (let step = 0; step < dim; step++) {
        const r = upward ? dim - 1 - step : step;
        for (let dc = 0; dc < 2; dc++) {
          const c = right - dc;
          if (used[r][c]) continue;
          const dark = bitIdx < totalBits ? ((finalCw[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) : 0;
          bitIdx++;
          grid[r][c] = dark ^ ((r + c) % 2 === 0 ? 1 : 0);
        }
      }
    }
    // Format string for Level L (01) + Mask 0 (000): 0x77c4
    const fmt = 0x77c4;
    const fmtCoordsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    const fmtCoordsB = [[dim - 1, 8], [dim - 2, 8], [dim - 3, 8], [dim - 4, 8], [dim - 5, 8], [dim - 6, 8], [dim - 7, 8], [8, dim - 8], [8, dim - 7], [8, dim - 6], [8, dim - 5], [8, dim - 4], [8, dim - 3], [8, dim - 2], [8, dim - 1]];
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> (14 - i)) & 1;
      grid[fmtCoordsA[i][0]][fmtCoordsA[i][1]] = bit;
      grid[fmtCoordsB[i][0]][fmtCoordsB[i][1]] = bit;
    }

    const quiet = 2;
    const vb = dim + quiet * 2;
    let pathD = '';
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (grid[r][c]) pathD += `M${c + quiet},${r + quiet}h1v1h-1z`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Number(sizePx) || 104}" height="${Number(sizePx) || 104}" viewBox="0 0 ${vb} ${vb}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${vb}" height="${vb}" fill="#ffffff"/><path d="${pathD}" fill="#111111"/></svg>`;
  }

  // =========================================================================
  // STORAGE, TOKEN HASHING & GITHUB API
  // =========================================================================
  function lsGet(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch { /* ignore */ }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  function getStoredGitHubToken() {
    try {
      return sessionStorage.getItem(ADMIN_GH_TOKEN_KEY) || localStorage.getItem(ADMIN_GH_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  function storeGitHubToken(token, remember) {
    try {
      sessionStorage.removeItem(ADMIN_GH_TOKEN_KEY);
      localStorage.removeItem(ADMIN_GH_TOKEN_KEY);
      if (!token) return;
      if (remember) localStorage.setItem(ADMIN_GH_TOKEN_KEY, token);
      else sessionStorage.setItem(ADMIN_GH_TOKEN_KEY, token);
    } catch { /* ignore */ }
  }

  function tokenFingerprint(token) {
    // Lightweight non-reversible fingerprint so offline unlock only matches the exact verified token.
    const s = String(token || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `v1-${(h >>> 0).toString(16)}-${s.length}`;
  }

  function saveVerifiedMeta(token, login) {
    lsSet(ADMIN_VERIFIED_META_KEY, JSON.stringify({
      login,
      fp: tokenFingerprint(token),
      verifiedAt: Date.now()
    }));
  }

  function readVerifiedMeta() {
    try {
      const parsed = JSON.parse(lsGet(ADMIN_VERIFIED_META_KEY, 'null'));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async function verifyGitHubToken(token, fetchImpl = fetch) {
    const clean = String(token || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    if (!clean) throw new Error('Enter your GitHub Personal Access Token.');
    const headers = {
      Authorization: `Bearer ${clean}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    let repoRes;
    try {
      repoRes = await fetchImpl(`https://api.github.com/repos/${CATALOG_REPO_ADMIN}/${CATALOG_REPO_NAME}`, { headers, cache: 'no-store' });
    } catch {
      const err = new Error('Could not reach GitHub API. Check your internet connection.');
      err.networkError = true;
      throw err;
    }
    if (repoRes.status === 401) {
      const err = new Error('Token is invalid or expired. Generate a new Fine-Grained Token on GitHub.');
      err.authError = true;
      throw err;
    }
    if (repoRes.status === 403 || repoRes.status === 404) {
      const err = new Error('Token lacks access to satyanarayanjewellery/shop. Select this repository when creating the token.');
      err.authError = true;
      throw err;
    }
    if (!repoRes.ok) throw new Error(`GitHub verification failed (HTTP ${repoRes.status}).`);
    const repo = await repoRes.json();
    if (!repo.permissions || repo.permissions.push !== true) {
      const err = new Error('This token is read-only or lacks write access. Enable "Contents: Read and write" on satyanarayanjewellery/shop.');
      err.authError = true;
      throw err;
    }
    let login = CATALOG_REPO_ADMIN;
    try {
      const userRes = await fetchImpl('https://api.github.com/user', { headers, cache: 'no-store' });
      if (userRes.ok) {
        const u = await userRes.json();
        if (u && u.login) login = u.login;
      }
    } catch { /* fine-grained token may omit user read */ }
    return { token: clean, login };
  }

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const bin = atob(String(b64 || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const str = String(reader.result || '');
        const idx = str.indexOf(',');
        resolve(idx >= 0 ? str.slice(idx + 1) : str);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read media file'));
      reader.readAsDataURL(blob);
    });
  }

  async function ghContentsRequest(method, repoPath, body = null) {
    if (!state.admin.token) throw new Error('Not signed in with a GitHub Admin Token.');
    const url = `https://api.github.com/repos/${CATALOG_REPO_ADMIN}/${CATALOG_REPO_NAME}/contents/${repoPath}`;
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${state.admin.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      cache: 'no-store'
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j && j.message) detail = j.message;
      } catch { /* ignore */ }
      throw new Error(`GitHub API error: ${detail}`);
    }
    return res.json();
  }

  // =========================================================================
  // INDEXEDDB LOCAL DRAFTS (SHARED WITH CUSTOMER APP DB SCHEMA)
  // =========================================================================
  function openCatalogDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open('satyanarayan_catalog_db', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('local_products')) {
          req.result.createObjectStore('local_products', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadLocalDrafts() {
    try {
      const db = await openCatalogDB();
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction('local_products', 'readonly');
        const req = tx.objectStore('local_products').getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      });
      rows.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
      state.admin.localItems = rows;
    } catch {
      state.admin.localItems = [];
    }
  }

  async function saveLocalDraft(item) {
    const db = await openCatalogDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('local_products', 'readwrite');
      tx.objectStore('local_products').put(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteLocalDraft(id) {
    const db = await openCatalogDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('local_products', 'readwrite');
      tx.objectStore('local_products').delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // =========================================================================
  // UI TOASTS, CONFIRM MODAL & NAVIGATION
  // =========================================================================
  const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

  function showToast(msg, type = 'info') {
    const stack = $('toast-stack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'success' ? 'toast-success' : type === 'alert' ? 'toast-alert' : type === 'error' ? 'toast-error' : ''}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 260);
    }, 3600);
  }

  let confirmCallback = null;
  function openConfirm(title, message, okLabel, onConfirm) {
    const modal = $('confirm-modal');
    if (!modal) return;
    $('confirm-title').textContent = title;
    $('confirm-msg').textContent = message;
    $('btn-confirm-ok').textContent = okLabel || 'Confirm';
    confirmCallback = onConfirm;
    modal.classList.remove('hidden');
  }
  function closeConfirm() {
    $('confirm-modal')?.classList.add('hidden');
    confirmCallback = null;
  }

  function switchView(viewName) {
    const valid = ['desk', 'catalog', 'exchanges', 'accuracy', 'settings'];
    if (!valid.includes(viewName)) return;
    state.activeView = viewName;
    valid.forEach((v) => {
      const el = $(`view-${v}`);
      if (!el) return;
      const on = v === viewName;
      el.classList.toggle('hidden', !on);
      if (on) {
        el.classList.remove('view-animate');
        requestAnimationFrame(() => el.classList.add('view-animate'));
      }
    });
    document.querySelectorAll('[data-view]').forEach((btn) => {
      const active = btn.dataset.view === viewName;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    if (viewName === 'exchanges') renderExchangeComparison();
    if (viewName === 'accuracy') {
      renderMarketAccuracy();
      if (!state.accuracy.feeds.length && state.prices) {
        fetchMarketAccuracy(false).then(renderMarketAccuracy);
      }
    }
    if (viewName === 'catalog') {
      renderCatalog();
      updateAutoPriceHint();
    }
    if (viewName === 'settings') {
      updateCalculators();
      populateBillCatalogPicker();
      renderBillSlip();
      renderOrderBook();
      renderStatutoryPreview();
      updateDiagnostics();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function switchSubtab(subtab) {
    const valid = ['calc', 'bill', 'orders', 'statutory', 'app'];
    if (!valid.includes(subtab)) return;
    state.activeSubtab = subtab;
    valid.forEach((s) => {
      $(`subpanel-${s}`)?.classList.toggle('hidden', s !== subtab);
    });
    document.querySelectorAll('[data-subtab]').forEach((btn) => {
      const on = btn.dataset.subtab === subtab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (subtab === 'calc') updateCalculators();
    if (subtab === 'bill') {
      populateBillCatalogPicker();
      renderBillSlip();
    }
    if (subtab === 'orders') renderOrderBook();
    if (subtab === 'statutory') renderStatutoryPreview();
    if (subtab === 'app') updateDiagnostics();
  }

  // =========================================================================
  // LIVE BULLION & FX ENGINE (PARITY WITH CUSTOMER PRICE DESK)
  // =========================================================================
  async function fetchWithTimeout(url, ms = 4500) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function raceTier(tier, timeoutMs, guard = null) {
    const attempts = tier.map(async (p) => {
      const json = await fetchWithTimeout(p.url, timeoutMs);
      const val = p.parse(json);
      if (!Number.isFinite(val) || val <= 0) throw new Error('invalid');
      if (guard && !guard(val)) throw new Error('guarded');
      const asOf = typeof p.parseAsOf === 'function' ? p.parseAsOf(json) : null;
      return { val, source: p.name, asOf, live: Boolean(p.live) };
    });
    return Promise.any(attempts);
  }

  async function fetchFromTiers(tiers, guard = null) {
    for (let i = 0; i < tiers.length; i++) {
      try {
        return await raceTier(tiers[i], i === 0 ? 3200 : 4000, guard);
      } catch { /* next tier */ }
    }
    throw new Error('all tiers failed');
  }

  function readCachedRates() {
    try {
      const raw = JSON.parse(lsGet(STORAGE_KEYS.lastRates, 'null'));
      if (!raw || typeof raw !== 'object') return null;
      if (!spotInBand(raw.spotGold, 'gold') || !spotInBand(raw.spotSilver, 'silver')) return null;
      if (!validateUsdInr(raw.usdInr, null).ok) return null;
      return raw;
    } catch { return null; }
  }

  function persistCachedRates() {
    if (!spotInBand(state.live.spotGold, 'gold') || !spotInBand(state.live.spotSilver, 'silver')) return;
    if (!validateUsdInr(state.live.usdInr, null).ok) return;
    lsSet(STORAGE_KEYS.lastRates, JSON.stringify({
      spotGold: roundSpot(state.live.spotGold),
      spotSilver: roundSpot(state.live.spotSilver),
      usdInr: roundFxRate(state.live.usdInr),
      fxSource: state.live.fxSource || '',
      fxLive: Boolean(state.live.fxLive),
      usdInrAsOf: state.live.usdInrAsOf || null,
      goldSource: state.live.goldSource || '',
      ts: Date.now()
    }));
  }

  function hydrateCachedRates() {
    const cached = readCachedRates();
    if (!cached) return;
    state.live.spotGold = cached.spotGold;
    state.live.spotSilver = cached.spotSilver;
    state.live.usdInr = cached.usdInr;
    state.live.fxSource = cached.fxSource || '';
    state.live.fxLive = Boolean(cached.fxLive);
    state.live.usdInrAsOf = cached.usdInrAsOf || null;
    state.live.goldSource = cached.goldSource || 'Cached';
    state.live.cachedTs = cached.ts || null;
    repriceAndRender(false);
  }

  function captureRateOfDay(prices, now = new Date()) {
    if (!prices || !Number.isFinite(prices.gold916ExGstGram)) return null;
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const existing = readRateOfDay();
    if (existing && existing.date === key) return existing;
    if (now.getHours() !== 12) return null;
    const snap = {
      date: key,
      capturedAt: now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
      rates: {
        g999: prices.gold999ExGstGram,
        g995: prices.gold995ExGstGram,
        g916: prices.gold916ExGstGram,
        g750: prices.gold18ExGstGram
      }
    };
    lsSet(STORAGE_KEYS.rateOfDay, JSON.stringify(snap));
    return snap;
  }

  function readRateOfDay() {
    try {
      const parsed = JSON.parse(lsGet(STORAGE_KEYS.rateOfDay, 'null'));
      return parsed && parsed.rates ? parsed : null;
    } catch { return null; }
  }

  async function refreshLiveFx(force = false) {
    if (state.live.fxInFlight) return state.live.fxInFlight;
    const now = Date.now();
    const hasRate = Number.isFinite(state.live.usdInr) && state.live.usdInr > 0;
    const age = now - state.live.lastFxSync;
    if (!force && hasRate && now - state.live.lastFxAttempt < FX_LIVE_REFRESH_MS - 1000) {
      return state.live.usdInr;
    }
    state.live.lastFxAttempt = now;
    const task = (async () => {
      let res = null;
      try {
        if (!hasRate) {
          // Cold load: hedge daily tiers if live tier is silent, while guaranteeing settlement
          // even if every live and daily feed fails (e.g. offline device).
          res = await new Promise((resolve) => {
            let settled = false;
            let dailyStarted = false;
            let dailySettled = false;
            let liveSettled = false;
            let hedgeTimer = null;
            const finish = (v) => {
              if (settled) return;
              settled = true;
              if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null; }
              resolve(v);
            };
            const startDaily = () => {
              if (dailyStarted || settled) return;
              dailyStarted = true;
              if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null; }
              fetchFromTiers(FX_TIERS.slice(1), (v) => validateUsdInr(v, state.live.usdInr).ok)
                .then((r) => { dailySettled = true; finish(r); })
                .catch(() => { dailySettled = true; if (liveSettled) finish(null); });
            };
            raceTier(FX_TIERS[0], 3500, (v) => validateUsdInr(v, state.live.usdInr).ok)
              .then((r) => {
                liveSettled = true;
                if (!settled) finish(r);
                else commitFxRate(r);
              })
              .catch(() => {
                liveSettled = true;
                if (dailySettled) finish(null);
                else startDaily();
              });
            hedgeTimer = setTimeout(startDaily, FX_DAILY_HEDGE_MS);
          });
        } else {
          res = await raceTier(FX_TIERS[0], 3500, (v) => validateUsdInr(v, state.live.usdInr).ok);
        }
      } catch {
        if (!hasRate || age > FX_DAILY_REFRESH_MS) {
          try {
            res = await fetchFromTiers(FX_TIERS.slice(1), (v) => validateUsdInr(v, state.live.usdInr).ok);
          } catch { /* keep held rate */ }
        }
      }
      if (res) commitFxRate(res);
      return state.live.usdInr;
    })();
    state.live.fxInFlight = task;
    try { return await task; } finally { state.live.fxInFlight = null; }
  }

  function commitFxRate(res) {
    const check = validateUsdInr(res.val, state.live.usdInr);
    if (!check.ok) return;
    state.live.usdInr = roundFxRate(check.value);
    state.live.fxSource = res.source;
    state.live.fxLive = Boolean(res.live);
    state.live.usdInrAsOf = res.asOf || null;
    state.live.lastFxSync = Date.now();
    repriceAndRender(true);
  }

  function scheduleFxHeartbeat() {
    clearTimeout(state.live.fxTimer);
    if (typeof document !== 'undefined' && document.hidden) return;
    state.live.fxTimer = setTimeout(() => {
      refreshLiveFx(false).catch(() => {});
      scheduleFxHeartbeat();
    }, FX_LIVE_REFRESH_MS);
  }

  async function syncMetalsRest(isManual = false) {
    const fxP = refreshLiveFx(isManual);
    const goldP = fetchFromTiers(GOLD_TIERS, (v) => acceptSpot(v, 'gold', state.live.spotGold).ok)
      .then((res) => {
        const chk = acceptSpot(res.val, 'gold', state.live.spotGold);
        if (chk.ok) {
          state.live.spotGold = chk.value;
          state.live.goldSource = res.source;
          state.live.connected = true;
          state.live.lastSync = new Date();
          repriceAndRender(true);
        }
      }).catch(() => {});
    const silverP = fetchFromTiers(SILVER_TIERS, (v) => acceptSpot(v, 'silver', state.live.spotSilver).ok)
      .then((res) => {
        const chk = acceptSpot(res.val, 'silver', state.live.spotSilver);
        if (chk.ok) {
          state.live.spotSilver = chk.value;
          state.live.connected = true;
          state.live.lastSync = new Date();
          repriceAndRender(true);
        }
      }).catch(() => {});
    await Promise.allSettled([fxP, goldP, silverP]);
    if (isManual) showToast('Live market feeds synced.', 'success');
  }

  function connectLiveWebSockets() {
    if (typeof WebSocket === 'undefined') return;
    state.live.wsSockets.forEach((ws) => { try { ws.close(); } catch { /* ignore */ } });
    state.live.wsSockets = [];
    state.live.wsConnected = false;

    const providers = [
      { name: 'Binance', url: 'wss://fstream.binance.com/public/stream?streams=xauusdt@bookTicker/xagusdt@bookTicker', type: 'binance' },
      { name: 'OKX', url: 'wss://ws.okx.com:8443/ws/v5/public', type: 'okx' },
      { name: 'Bybit', url: 'wss://stream.bybit.com/v5/public/linear', type: 'bybit' }
    ];

    providers.forEach((p) => {
      try {
        const ws = new WebSocket(p.url);
        state.live.wsSockets.push(ws);
        ws.onopen = () => {
          if (p.type === 'okx') {
            ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'tickers', instId: 'XAU-USDT-SWAP' }, { channel: 'tickers', instId: 'XAG-USDT-SWAP' }] }));
          } else if (p.type === 'bybit') {
            ws.send(JSON.stringify({ op: 'subscribe', args: ['tickers.XAUUSDT'] }));
          }
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            let sym = null;
            let mid = NaN;
            if (p.type === 'binance' && msg.data && msg.data.s) {
              sym = msg.data.s.startsWith('XAU') ? 'gold' : msg.data.s.startsWith('XAG') ? 'silver' : null;
              mid = (Number(msg.data.b) + Number(msg.data.a)) / 2;
            } else if (p.type === 'okx' && Array.isArray(msg.data) && msg.data[0]) {
              const d = msg.data[0];
              sym = d.instId === 'XAU-USDT-SWAP' ? 'gold' : d.instId === 'XAG-USDT-SWAP' ? 'silver' : null;
              mid = (Number(d.bidPx) + Number(d.askPx)) / 2;
            } else if (p.type === 'bybit' && msg.data && msg.topic === 'tickers.XAUUSDT') {
              sym = 'gold';
              mid = (Number(msg.data.bid1Price) + Number(msg.data.ask1Price)) / 2;
            }
            if (!sym || !Number.isFinite(mid)) return;
            if (!state.live.wsConnected) {
              state.live.wsConnected = true;
              state.live.wsWinner = p.name;
              state.live.wsSockets.forEach((other) => { if (other !== ws) try { other.close(); } catch { /* ignore */ } });
              state.live.wsSockets = [ws];
            }
            const prev = sym === 'gold' ? state.live.spotGold : state.live.spotSilver;
            const chk = acceptSpot(mid, sym, prev);
            if (!chk.ok) return;
            if (sym === 'gold') {
              state.live.spotGold = chk.value;
              state.live.goldSource = `${p.name} WS`;
            } else {
              state.live.spotSilver = chk.value;
            }
            state.live.connected = true;
            state.live.lastSync = new Date();
            repriceAndRender(true);
          } catch { /* ignore malformed tick */ }
        };
        ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
      } catch { /* ignore */ }
    });

    clearInterval(state.live.restTimer);
    state.live.restTimer = setInterval(() => {
      if (document.hidden) return;
      if (!state.live.wsConnected || !state.live.lastSync || Date.now() - state.live.lastSync.getTime() > 20000) {
        syncMetalsRest(false);
      }
    }, REST_FALLBACK_MS);
  }

  function repriceAndRender(saveCache = true) {
    if (!Number.isFinite(state.live.spotGold) || !Number.isFinite(state.live.spotSilver) || !Number.isFinite(state.live.usdInr)) return;
    const prev = state.prices;
    state.prevPrices = prev;
    state.prices = computeCityPrices(state.cityId, state.live.spotGold, state.live.spotSilver, state.live.usdInr);
    captureRateOfDay(state.prices);
    if (saveCache && state.live.connected) persistCachedRates();
    renderDeskRates(prev);
    if (state.activeView === 'catalog') updateAutoPriceHint();
    if (state.activeView === 'exchanges') renderExchangeComparison();
    if (state.activeView === 'settings' && state.activeSubtab === 'calc') updateCalculators();
    if (state.activeView === 'settings' && state.activeSubtab === 'bill') renderBillSlip();
    if (state.activeView === 'settings' && state.activeSubtab === 'statutory') renderStatutoryPreview();
  }

  function flashValue(el, diff) {
    if (!el || !diff) return;
    el.classList.remove('flash-up', 'flash-down');
    el.classList.add(diff > 0 ? 'flash-up' : 'flash-down');
    clearTimeout(el._ft);
    el._ft = setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 550);
  }

  function renderDeskRates(prev = null) {
    const p = state.prices;
    renderLiveStatusBadge();
    if (!p) return;

    const gDiff = prev ? p.gold999ExGst - prev.gold999ExGst : 0;
    const sDiff = prev ? p.silver999ExGst - prev.silver999ExGst : 0;

    const setVal = (id, text, diff = 0) => {
      const el = $(id);
      if (!el) return;
      if (el.textContent !== text) {
        el.textContent = text;
        if (diff) flashValue(el, diff);
      }
    };

    setVal('r-g999-ex', fmtINR(p.gold999ExGst), gDiff);
    setVal('r-g999-gst', `Incl. GST: ${fmtINR(p.gold999)} · 1g: ${fmtINR(p.gold999ExGstGram, 0)}`);
    setVal('r-g995-ex', fmtINR(p.gold995ExGst), gDiff);
    setVal('r-g995-gst', `Incl. GST: ${fmtINR(p.gold995)} · 1g: ${fmtINR(p.gold995ExGstGram, 0)}`);
    setVal('r-g916-ex', fmtINR(p.gold916ExGst), gDiff);
    setVal('r-g916-gst', `Incl. GST: ${fmtINR(p.gold916)} · 1g: ${fmtINR(p.gold916ExGstGram, 0)}`);
    setVal('r-g750-ex', fmtINR(p.gold18ExGst), gDiff);
    setVal('r-g750-gst', `Incl. GST: ${fmtINR(p.gold18)} · 1g: ${fmtINR(p.gold18ExGstGram, 0)}`);

    setVal('r-s999-ex', fmtINR(p.silver999ExGst), sDiff);
    setVal('r-s999-gst', `Incl. GST: ${fmtINR(p.silver999)} · 1g: ${fmtINR(p.silver999ExGstGram, 2)}`);
    setVal('r-s925-ex', fmtINR(p.silver925ExGst), sDiff);
    setVal('r-s925-gst', `Incl. GST: ${fmtINR(p.silver925)} · 1g: ${fmtINR(p.silver925ExGstGram, 2)}`);
    setVal('r-s750-ex', fmtINR(p.silver750ExGst), sDiff);
    setVal('r-s750-gst', `Incl. GST: ${fmtINR(p.silver750)} · 1g: ${fmtINR(p.silver750ExGstGram, 2)}`);

    setVal('silver-mcx-badge', `MCX: ${fmtINR(p.silverMCX)}`);
    setVal('gold-source-badge', state.live.goldSource || 'Live');

    const calG = state.accuracy.calibPctGold;
    const calS = state.accuracy.calibPctSilver;
    setVal('gold-calib-note', calG ? `Calibrated ${calG >= 0 ? '+' : ''}${calG.toFixed(2)}% vs spot` : `Landed parity · ${statutoryLabel('gold')}`);
    setVal('silver-calib-note', calS ? `Calibrated ${calS >= 0 ? '+' : ''}${calS.toFixed(2)}% vs spot` : `Landed parity · ${statutoryLabel('silver')}`);

    setVal('r-spot-gold', `${fmtUSD(p.spotGold)}/oz`, gDiff);
    setVal('r-spot-gold-g', `Per gram: ${fmtUSD(p.spotGold / TROY_OZ_TO_GRAMS)}`);
    setVal('r-spot-silver', `${fmtUSD(p.spotSilver)}/oz`, sDiff);
    setVal('r-spot-silver-g', `Per gram: ${fmtUSD(p.spotSilver / TROY_OZ_TO_GRAMS)}`);

    setVal('fx-val', `₹${Number(p.usdInr).toFixed(2)}`);
    setVal('fx-meta', `${state.live.fxLive ? 'Live' : 'Daily'} · ${state.live.fxSource || 'reference'}`);
    setVal('fx-xau', `${fmtUSD(p.spotGold)}/oz`);
    setVal('fx-xag', `${fmtUSD(p.spotSilver)}/oz`);

    const gStat = statutoryRatesFor('gold');
    const sStat = statutoryRatesFor('silver');
    const statShort = gStat.importDutyPct === sStat.importDutyPct && gStat.gstPct === sStat.gstPct
      ? `${gStat.importDutyPct}% + ${gStat.gstPct}%`
      : `Au ${gStat.importDutyPct}% · Ag ${sStat.importDutyPct}%`;
    setVal('fx-statutory', statShort);
    setVal('kpi-statutory', statShort);
    setVal('kpi-statutory-sub', `Verified ${gStat.verifiedOn}`);
    setVal('calc-gst-label', String(gStat.gstPct));
    setVal('ex-duty-label', String(gStat.importDutyPct));

    const rod = readRateOfDay();
    if (rod && rod.rates && Number.isFinite(rod.rates.g916)) {
      setVal('r-rod-916', `${fmtINR(rod.rates.g916, 0)}/g`);
      setVal('r-rod-meta', `${rod.date} · ${rod.capturedAt}`);
    } else {
      const hr = new Date().getHours();
      setVal('r-rod-916', hr < 12 ? 'Awaiting 12 PM' : 'Window closed');
      setVal('r-rod-meta', hr < 12 ? 'Captures automatically at noon' : 'Captures tomorrow 12:00 PM');
    }
  }

  function renderLiveStatusBadge() {
    const pill = $('live-status-pill');
    const sub = $('rates-freshness-sub');
    const offlineBanner = $('offline-banner');
    const offlineText = $('offline-banner-text');
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const liveTs = state.live.lastSync ? state.live.lastSync.getTime() : 0;
    const cacheTs = Number(state.live.cachedTs) || 0;
    const isFresh = liveTs > 0 && (Date.now() - liveTs) <= LIVE_TICK_FRESH_MS;

    if (pill) {
      if (!online) {
        pill.className = 'pill pill-red';
        pill.innerHTML = '<span class="dot dot-red"></span>Offline';
      } else if (isFresh) {
        pill.className = 'pill pill-green';
        pill.innerHTML = `<span class="dot dot-green dot-pulse"></span>${escapeHtml(state.live.wsWinner ? `${state.live.wsWinner} Live` : 'Live')}`;
      } else if (cacheTs) {
        pill.className = 'pill pill-gold';
        pill.innerHTML = '<span class="dot dot-gold"></span>Saved Snapshot';
      } else {
        pill.className = 'pill';
        pill.innerHTML = '<span class="dot"></span>Connecting…';
      }
    }

    if (sub) {
      const city = CITIES[state.cityId] || CITIES.cuttack;
      if (liveTs) {
        sub.textContent = `${city.name}, ${city.state} · Updated ${formatRelativeAge(Date.now() - liveTs)} · ${statutoryLabel('gold')}`;
      } else if (cacheTs) {
        sub.textContent = `${city.name}, ${city.state} · Saved snapshot (${formatRelativeAge(Date.now() - cacheTs)}, not live)`;
      } else {
        sub.textContent = `${city.name}, ${city.state} · Connecting to live bullion & FX feeds…`;
      }
    }

    if (offlineBanner && offlineText) {
      if (!online || state.admin.offlineSession) {
        offlineBanner.classList.remove('hidden');
        offlineText.textContent = !online
          ? 'You are offline. Viewing cached rates & catalogue — new jewellery can still be saved as Local Drafts and published once back online.'
          : 'Offline Admin Session active. Tap Sync or Publish once internet reconnects to re-verify with GitHub.';
      } else {
        offlineBanner.classList.add('hidden');
      }
    }
  }

  function renderClockAndMarket() {
    const clock = $('header-clock');
    if (clock) {
      clock.textContent = `${new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      }).format(new Date())} IST`;
    }
    const mkt = $('header-market-pill');
    if (mkt) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23'
      }).formatToParts(new Date());
      const wd = parts.find((x) => x.type === 'weekday')?.value || '';
      const h = (Number(parts.find((x) => x.type === 'hour')?.value || 0)) % 24;
      const m = Number(parts.find((x) => x.type === 'minute')?.value || 0);
      const mins = h * 60 + m;
      const isWeekend = wd === 'Sat' || wd === 'Sun';
      const mcxOpen = !isWeekend && mins >= 540 && mins <= 1410;
      mkt.textContent = isWeekend ? 'MCX Weekend Closed' : mcxOpen ? 'MCX Open' : 'MCX After Hours';
    }
  }

  // =========================================================================
  // STATUTORY DUTY & GST LOADER + LIVE GITHUB PUBLISHER
  // =========================================================================
  async function loadStatutoryRates(populateForm = true) {
    try {
      // Tolerate both cache shapes: the shared localStorage key is read by both PWAs, and the
      // customer desk stores { fetchedAt, rates } while older admin builds stored the bare payload.
      const parsed = JSON.parse(lsGet(STORAGE_KEYS.statutoryRates, 'null'));
      const cached = sanitizeStatutoryPayload(parsed && (parsed.rates || parsed));
      if (cached && !state.statutory) state.statutory = cached;
    } catch { /* ignore */ }

    try {
      const res = await fetch(`${STATUTORY_FETCH_PATH}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        const clean = sanitizeStatutoryPayload(raw);
        if (clean) {
          state.statutory = clean;
          state.statutoryRaw = raw;
          lsSet(STORAGE_KEYS.statutoryRates, JSON.stringify({ fetchedAt: Date.now(), rates: clean }));
        }
      }
    } catch { /* keep cached or default */ }

    if (populateForm) populateStatutoryForm();
    repriceAndRender(false);
    renderStatutoryNotice();
  }

  function populateStatutoryForm() {
    const g = statutoryRatesFor('gold');
    const s = statutoryRatesFor('silver');
    const set = (id, v) => { const el = $(id); if (el) el.value = String(v); };
    set('st-gold-duty', g.importDutyPct);
    set('st-gold-gst', g.gstPct);
    set('st-gold-eff', g.effectiveFrom);
    set('st-gold-ver', g.verifiedOn);
    set('st-gold-note', g.note);
    set('st-silver-duty', s.importDutyPct);
    set('st-silver-gst', s.gstPct);
    set('st-silver-eff', s.effectiveFrom);
    set('st-silver-ver', s.verifiedOn);
    set('st-silver-note', s.note);
    renderStatutoryPreview();
  }

  function readStatutoryFormDraft() {
    return {
      gold: {
        importDutyPct: Number($('st-gold-duty')?.value),
        gstPct: Number($('st-gold-gst')?.value),
        effectiveFrom: ($('st-gold-eff')?.value || '').trim(),
        verifiedOn: ($('st-gold-ver')?.value || '').trim(),
        note: ($('st-gold-note')?.value || '').trim(),
        sources: statutoryRatesFor('gold').sources
      },
      silver: {
        importDutyPct: Number($('st-silver-duty')?.value),
        gstPct: Number($('st-silver-gst')?.value),
        effectiveFrom: ($('st-silver-eff')?.value || '').trim(),
        verifiedOn: ($('st-silver-ver')?.value || '').trim(),
        note: ($('st-silver-note')?.value || '').trim(),
        sources: statutoryRatesFor('silver').sources
      }
    };
  }

  function renderStatutoryPreview() {
    const draft = readStatutoryFormDraft();
    const check = validateStatutoryDraft(draft);
    const errEl = $('st-error');
    if (errEl) {
      if (!check.ok) {
        errEl.textContent = check.errors.join(' ');
        errEl.classList.remove('hidden');
      } else {
        errEl.classList.add('hidden');
      }
    }
    if (!check.ok || !state.prices) return;
    const current = computeCityPrices('cuttack', state.live.spotGold, state.live.spotSilver, state.live.usdInr);
    const preview = computeCityPrices('cuttack', state.live.spotGold, state.live.spotSilver, state.live.usdInr, { statutory: check.payload });
    const paint = (valId, diffId, next, cur) => {
      const d = next - cur;
      const ve = $(valId);
      const de = $(diffId);
      if (ve) ve.textContent = fmtINR(next);
      if (de) {
        de.textContent = d === 0 ? 'No change vs live' : `${d > 0 ? '+' : '−'}${fmtINR(Math.abs(d))} vs live`;
        de.style.color = d === 0 ? 'var(--text-dim)' : d > 0 ? 'var(--green-soft)' : 'var(--red-soft)';
      }
    };
    paint('st-prev-g999', 'st-diff-g999', preview.gold999, current.gold999);
    paint('st-prev-g916', 'st-diff-g916', preview.gold916, current.gold916);
    paint('st-prev-s999', 'st-diff-s999', preview.silver999, current.silver999);
  }

  function renderStatutoryNotice() {
    const box = $('acc-statutory-notice');
    if (!box) return;
    if (statutoryIsStale()) {
      const g = statutoryRatesFor('gold');
      box.textContent = `Statutory duty/GST was last verified on ${g.verifiedOn} (> ${STATUTORY_REVIEW_DAYS} days ago). Review Government of India notifications in Tools & Rules → Duty & GST Publisher.`;
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }

  async function publishStatutoryRatesToGitHub() {
    const draft = readStatutoryFormDraft();
    const check = validateStatutoryDraft(draft);
    if (!check.ok) {
      showToast(check.errors[0], 'error');
      return;
    }
    const btn = $('btn-st-publish');
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    try {
      let sha = null;
      try {
        const meta = await ghContentsRequest('GET', `${STATUTORY_REPO_PATH}?ref=${CATALOG_REPO_BRANCH}`);
        sha = meta && meta.sha ? meta.sha : null;
      } catch { /* file may not exist */ }

      const today = todayIstIso();
      const fileContent = {
        _comment: 'Statutory landing costs used to price gold & silver in INR. Update this file when the Government of India changes customs duty or GST — the desk picks it up on the next load, no code change needed. Verify each change against a primary source before publishing.',
        updatedAt: today,
        gold: check.payload.gold,
        silver: check.payload.silver
      };
      const putBody = {
        message: `Update statutory duty/GST (${check.payload.gold.importDutyPct}%/${check.payload.gold.gstPct}% Au, ${check.payload.silver.importDutyPct}%/${check.payload.silver.gstPct}% Ag)`,
        content: utf8ToBase64(`${JSON.stringify(fileContent, null, 2)}\n`),
        branch: CATALOG_REPO_BRANCH
      };
      if (sha) putBody.sha = sha;
      await ghContentsRequest('PUT', STATUTORY_REPO_PATH, putBody);

      state.statutory = check.payload;
      lsSet(STORAGE_KEYS.statutoryRates, JSON.stringify({ fetchedAt: Date.now(), rates: check.payload }));
      repriceAndRender(true);
      renderStatutoryNotice();
      renderStatutoryPreview();
      showToast('Published catalog/statutory-rates.json! Both Customer & Admin PWAs will use the new rates.', 'success');
    } catch (err) {
      showToast(err?.message || 'Could not publish statutory rates.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Publish Statutory Rates to GitHub'; }
    }
  }

  // =========================================================================
  // JEWELLERY CATALOGUE STUDIO: UPLOAD, EDIT, DRAFTS & GITHUB SYNC
  // =========================================================================
  async function loadPublishedCatalog() {
    try {
      const res = await fetch(`${CATALOG_MANIFEST_FETCH_PATH}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          state.admin.publishedItems = data
            .filter((p) => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string')
            .map((p) => ({
              ...p,
              media: Array.isArray(p.media)
                ? p.media
                    .map((m) => {
                      const clean = sanitizeCatalogMediaUrl(m && m.src);
                      return clean.startsWith(CATALOG_MEDIA_PREFIX)
                        ? {
                            type: m && m.type === 'video' ? 'video' : 'image',
                            src: clean,
                            mime: typeof (m && m.mime) === 'string' ? m.mime : ''
                          }
                        : null;
                    })
                    .filter(Boolean)
                : []
            }));
        }
      }
    } catch { /* offline or empty */ }
  }

  async function refreshAllCatalog() {
    await Promise.all([loadPublishedCatalog(), loadLocalDrafts()]);
    renderCatalog();
    updateAdminKpis();
  }

  function updateAdminKpis() {
    const liveN = state.admin.publishedItems.length;
    const draftN = state.admin.localItems.length;
    const set = (id, v) => { const el = $(id); if (el) el.textContent = String(v); };
    set('kpi-live-items', liveN);
    set('kpi-draft-items', draftN);
    set('studio-live-count', liveN);
    set('studio-draft-count', draftN);
    set('diag-drafts', draftN);

    const hasDrafts = draftN > 0;
    ['nav-draft-badge', 'mnav-draft-badge'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = String(draftN);
      el.classList.toggle('hidden', !hasDrafts);
    });
    const pubAll = $('btn-publish-all-drafts');
    const deskPub = $('btn-desk-publish-drafts');
    if (pubAll) {
      pubAll.classList.toggle('hidden', !hasDrafts);
      pubAll.textContent = `Publish All Drafts (${draftN})`;
    }
    if (deskPub) {
      deskPub.classList.toggle('hidden', !hasDrafts);
      deskPub.textContent = `Publish ${draftN} Draft${draftN > 1 ? 's' : ''}`;
    }
  }

  function setUploadProgress(visible, text = '', pct = 0) {
    const wrap = $('upload-progress');
    if (wrap) wrap.classList.toggle('hidden', !visible);
    if ($('upload-progress-text')) $('upload-progress-text').textContent = text;
    if ($('upload-progress-pct')) $('upload-progress-pct').textContent = `${Math.round(pct)}%`;
    if ($('upload-progress-bar')) $('upload-progress-bar').style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  function renderPendingFiles() {
    const wrap = $('upload-previews');
    if (!wrap) return;
    if (!state.admin.pendingFiles.length) {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML = state.admin.pendingFiles.map((f, idx) => {
      const tag = f.type === 'video'
        ? `<video src="${escapeHtml(f.previewUrl)}" muted playsinline></video>`
        : `<img src="${escapeHtml(f.previewUrl)}" alt="${escapeHtml(f.file.name)}" />`;
      return `
        <div class="media-thumb">
          ${tag}
          <span>${f.type === 'video' ? 'VID' : 'IMG'} · ${escapeHtml(formatFileBytes(f.file.size))}</span>
          <button type="button" class="media-remove" data-remove-pending="${idx}" aria-label="Remove">✕</button>
        </div>
      `;
    }).join('');
  }

  function clearPendingFiles() {
    state.admin.pendingFiles.forEach((f) => { try { URL.revokeObjectURL(f.previewUrl); } catch { /* ignore */ } });
    state.admin.pendingFiles = [];
    if ($('upload-media-input')) $('upload-media-input').value = '';
    if ($('upload-camera-input')) $('upload-camera-input').value = '';
    renderPendingFiles();
  }

  function addPendingFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (state.admin.pendingFiles.length >= MAX_MEDIA_PER_ITEM) {
        showToast(`Maximum ${MAX_MEDIA_PER_ITEM} files per item.`, 'alert');
        break;
      }
      const isImg = ALLOWED_IMAGE_MIME.test(file.type || '');
      const isVid = ALLOWED_VIDEO_MIME.test(file.type || '');
      if (!isImg && !isVid) {
        showToast(`Unsupported file "${file.name}". Use JPG, PNG, WebP, GIF, MP4, WebM, or MOV.`, 'alert');
        continue;
      }
      if (isImg && file.size > MAX_IMAGE_BYTES) {
        showToast(`Image "${file.name}" exceeds 12 MB.`, 'alert');
        continue;
      }
      if (isVid && file.size > MAX_VIDEO_LOCAL_BYTES) {
        showToast(`Video "${file.name}" exceeds 50 MB.`, 'alert');
        continue;
      }
      state.admin.pendingFiles.push({
        file,
        type: isVid ? 'video' : 'image',
        mime: file.type,
        previewUrl: URL.createObjectURL(file)
      });
    }
    renderPendingFiles();
  }

  async function optimizeImageForPublish(blob, mime) {
    if (mime === 'image/gif' || blob.size <= 350 * 1024) {
      return { blob, mime, ext: mediaExtFromFile({ type: mime }) };
    }
    try {
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = url;
        });
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const outBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
        if (outBlob && outBlob.size > 0 && outBlob.size < blob.size) {
          return { blob: outBlob, mime: 'image/webp', ext: 'webp' };
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch { /* fallback to original */ }
    return { blob, mime, ext: mediaExtFromFile({ type: mime }) };
  }

  async function fetchRemoteCatalogFromGitHub() {
    try {
      const file = await ghContentsRequest('GET', `${CATALOG_MANIFEST_REPO_PATH}?ref=${CATALOG_REPO_BRANCH}`);
      const list = JSON.parse(base64ToUtf8(file.content));
      return { sha: file.sha, items: Array.isArray(list) ? list : [] };
    } catch (err) {
      if (/404|Not Found/i.test(err.message || '')) return { sha: null, items: [] };
      throw err;
    }
  }

  async function publishItemToGitHub(item, mediaBlobs) {
    const safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '');
    const totalSteps = mediaBlobs.length + 2;
    let done = 0;
    const publishedMedia = [];

    for (let i = 0; i < mediaBlobs.length; i++) {
      const entry = mediaBlobs[i];
      const isVideo = entry.type === 'video';
      if (isVideo && entry.blob.size > MAX_VIDEO_PUBLISH_BYTES) {
        throw new Error(`Video "${entry.name || 'clip'}" exceeds the 20 MB website publish limit.`);
      }
      setUploadProgress(true, `Uploading ${isVideo ? 'video' : 'photo'} ${i + 1} of ${mediaBlobs.length}…`, (done / totalSteps) * 100);
      let uploadBlob = entry.blob;
      let uploadMime = entry.mime || entry.blob.type || (isVideo ? 'video/mp4' : 'image/jpeg');
      let ext = mediaExtFromFile({ type: uploadMime });
      if (!isVideo) {
        const opt = await optimizeImageForPublish(entry.blob, uploadMime);
        uploadBlob = opt.blob;
        uploadMime = opt.mime;
        ext = opt.ext;
      }
      const mediaPath = `${CATALOG_MEDIA_PREFIX}${safeId}-${i}.${ext}`;
      const mediaPut = {
        message: `Add jewellery media for ${item.name}`,
        content: await blobToBase64(uploadBlob),
        branch: CATALOG_REPO_BRANCH
      };
      try {
        await ghContentsRequest('PUT', mediaPath, mediaPut);
      } catch (err) {
        if (/HTTP 422|"sha" wasn't supplied/i.test(err && err.message ? err.message : '')) {
          const meta = await ghContentsRequest('GET', `${mediaPath}?ref=${CATALOG_REPO_BRANCH}`);
          if (meta && meta.sha) {
            await ghContentsRequest('PUT', mediaPath, { ...mediaPut, sha: meta.sha });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
      publishedMedia.push({ type: isVideo ? 'video' : 'image', src: mediaPath, mime: uploadMime });
      done += 1;
    }

    setUploadProgress(true, 'Updating catalog/products.json…', (done / totalSteps) * 100);
    const remote = await fetchRemoteCatalogFromGitHub();
    done += 1;

    const record = {
      id: safeId,
      name: item.name,
      category: item.category,
      purity: item.purity || '',
      weight: Number(item.weight) || 0,
      makingPct: Math.max(0, Number(item.makingPct) || 0),
      price: Number(item.price) || 0,
      sku: item.sku || '',
      stockStatus: normalizeStockStatus(item.stockStatus),
      featured: Boolean(item.featured),
      note: item.note || '',
      media: publishedMedia,
      createdAt: item.createdAt || new Date().toISOString()
    };
    const updatedList = [record, ...remote.items.filter((x) => x && x.id !== safeId)];
    const putPayload = {
      message: `Publish jewellery item: ${item.name}`,
      content: utf8ToBase64(`${JSON.stringify(updatedList, null, 2)}\n`),
      branch: CATALOG_REPO_BRANCH
    };
    if (remote.sha) putPayload.sha = remote.sha;
    await ghContentsRequest('PUT', CATALOG_MANIFEST_REPO_PATH, putPayload);
    setUploadProgress(true, 'Published live!', 100);

    const previewMedia = publishedMedia.map((m, idx) => ({ ...m, _previewBlob: mediaBlobs[idx]?.blob || null }));
    state.admin.publishedItems = [
      { ...record, media: previewMedia },
      ...state.admin.publishedItems.filter((x) => x.id !== safeId)
    ];
    return record;
  }

  async function updatePublishedItemOnGitHub(updatedFields) {
    const remote = await fetchRemoteCatalogFromGitHub();
    let found = false;
    const updatedList = remote.items.map((x) => {
      if (!x || x.id !== updatedFields.id) return x;
      found = true;
      return {
        ...x,
        name: updatedFields.name,
        category: updatedFields.category,
        purity: updatedFields.purity,
        weight: updatedFields.weight,
        makingPct: Math.max(0, Number(updatedFields.makingPct ?? x.makingPct) || 0),
        price: updatedFields.price,
        sku: updatedFields.sku,
        stockStatus: normalizeStockStatus(updatedFields.stockStatus ?? x.stockStatus),
        featured: updatedFields.featured !== undefined ? Boolean(updatedFields.featured) : Boolean(x.featured),
        note: updatedFields.note
      };
    });
    if (!found) throw new Error('Item no longer exists on GitHub.');
    const putPayload = {
      message: `Update jewellery item: ${updatedFields.name}`,
      content: utf8ToBase64(`${JSON.stringify(updatedList, null, 2)}\n`),
      branch: CATALOG_REPO_BRANCH
    };
    if (remote.sha) putPayload.sha = remote.sha;
    await ghContentsRequest('PUT', CATALOG_MANIFEST_REPO_PATH, putPayload);

    state.admin.publishedItems = state.admin.publishedItems.map((x) => (
      x.id === updatedFields.id ? { ...x, ...updatedFields } : x
    ));
  }

  async function repriceAllPublishedOnGitHub() {
    if (!state.prices) throw new Error('Waiting for live bullion rates before repricing.');
    const remote = await fetchRemoteCatalogFromGitHub();
    let count = 0;
    const updatedList = remote.items.map((x) => {
      if (!x || !(Number(x.weight) > 0)) return x;
      const est = computeAutoItemPrice({
        category: x.category || 'Gold',
        purity: x.purity || '',
        weight: Number(x.weight),
        makingPct: Number(x.makingPct) > 0 ? Number(x.makingPct) : 10,
        includeGst: true
      });
      if (!est) return x;
      count += 1;
      return { ...x, price: est.grandTotal, makingPct: Number(x.makingPct) > 0 ? Number(x.makingPct) : 10 };
    });
    if (!count) throw new Error('No weighted items found in published inventory to reprice.');
    const putPayload = {
      message: `Batch live reprice ${count} jewellery item(s)`,
      content: utf8ToBase64(`${JSON.stringify(updatedList, null, 2)}\n`),
      branch: CATALOG_REPO_BRANCH
    };
    if (remote.sha) putPayload.sha = remote.sha;
    await ghContentsRequest('PUT', CATALOG_MANIFEST_REPO_PATH, putPayload);
    state.admin.publishedItems = state.admin.publishedItems.map((x) => {
      const match = updatedList.find((u) => u && u.id === x.id);
      return match ? { ...x, price: match.price, makingPct: match.makingPct } : x;
    });
    return count;
  }

  async function deletePublishedItemFromGitHub(item) {
    const remote = await fetchRemoteCatalogFromGitHub();
    const target = remote.items.find((x) => x && x.id === item.id) || item;
    const updatedList = remote.items.filter((x) => x && x.id !== item.id);
    const putPayload = {
      message: `Remove jewellery item: ${item.name}`,
      content: utf8ToBase64(`${JSON.stringify(updatedList, null, 2)}\n`),
      branch: CATALOG_REPO_BRANCH
    };
    if (remote.sha) putPayload.sha = remote.sha;
    await ghContentsRequest('PUT', CATALOG_MANIFEST_REPO_PATH, putPayload);

    const mediaPaths = (target.media || [])
      .map((m) => sanitizeCatalogMediaUrl(m && m.src))
      .filter((s) => s.startsWith(CATALOG_MEDIA_PREFIX));
    for (const p of mediaPaths) {
      try {
        const meta = await ghContentsRequest('GET', `${p}?ref=${CATALOG_REPO_BRANCH}`);
        if (meta && meta.sha) {
          await ghContentsRequest('DELETE', p, {
            message: `Clean up media for removed item: ${item.name}`,
            sha: meta.sha,
            branch: CATALOG_REPO_BRANCH
          });
        }
      } catch { /* ignore cleanup failure */ }
    }
    state.admin.publishedItems = state.admin.publishedItems.filter((x) => x.id !== item.id);
  }

  function collectUploadForm() {
    const name = ($('f-name')?.value || '').trim();
    const rawPrice = ($('f-price')?.value || '').trim();
    const price = rawPrice === '' ? 0 : Number(rawPrice);
    if (!name) { showToast('Enter a jewellery name.', 'alert'); return null; }
    if (!Number.isFinite(price) || price < 0) { showToast('Enter a valid price or leave blank.', 'alert'); return null; }
    if (!state.admin.pendingFiles.length) { showToast('Select at least one photo or video.', 'alert'); return null; }
    return {
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      category: $('f-category')?.value || 'Gold',
      purity: ($('f-purity')?.value || '').trim(),
      weight: Math.max(0, Number($('f-weight')?.value) || 0),
      makingPct: Math.max(0, Number($('f-making')?.value) || 0),
      price,
      sku: ($('f-sku')?.value || '').trim(),
      stockStatus: normalizeStockStatus($('f-stock')?.value),
      featured: Boolean($('f-featured')?.checked),
      note: ($('f-note')?.value || '').trim(),
      createdAt: new Date().toISOString()
    };
  }

  function updateAutoPriceHint() {
    const bar = $('f-autoprice-hint');
    const txt = $('f-autoprice-text');
    if (!bar || !txt) return;
    const w = Math.max(0, Number($('f-weight')?.value) || 0);
    if (!(w > 0) || !state.prices) {
      bar.classList.add('hidden');
      return;
    }
    const est = computeAutoItemPrice({
      category: $('f-category')?.value || 'Gold',
      purity: ($('f-purity')?.value || '').trim(),
      weight: w,
      makingPct: Math.max(0, Number($('f-making')?.value) || 0),
      includeGst: true
    });
    if (!est) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    txt.textContent = `Live ${est.metal} estimate (${w}g): Metal ${fmtINR(est.baseValue)} + Making ${fmtINR(est.makingCharges)} + ${est.gstPct}% GST = ${fmtINR(est.grandTotal)} (tap "Auto ₹" to fill)`;
  }

  function revokeItemObjectUrls() {
    state.admin.objectUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* ignore */ } });
    state.admin.objectUrls = [];
  }

  function revokeLightboxObjectUrls() {
    state.admin.lightboxObjectUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* ignore */ } });
    state.admin.lightboxObjectUrls = [];
  }

  function resolveDisplayMedia(item, urlPool = state.admin.objectUrls) {
    return (Array.isArray(item.media) ? item.media : []).map((m) => {
      if (m && m._previewBlob instanceof Blob) {
        const u = URL.createObjectURL(m._previewBlob);
        urlPool.push(u);
        return { type: m.type === 'video' ? 'video' : 'image', src: u };
      }
      if (m && m.blob instanceof Blob) {
        const u = URL.createObjectURL(m.blob);
        urlPool.push(u);
        return { type: m.type === 'video' ? 'video' : 'image', src: u };
      }
      const src = toAdminMediaSrc(m && m.src);
      return src ? { type: m.type === 'video' ? 'video' : 'image', src } : null;
    }).filter(Boolean);
  }

  function renderCatalog() {
    const grid = $('catalog-grid');
    if (!grid) return;
    revokeItemObjectUrls();
    updateAdminKpis();

    const all = [
      ...state.admin.localItems.map((x) => ({ ...x, _source: 'local' })),
      ...state.admin.publishedItems.map((x) => ({ ...x, _source: 'published' }))
    ];
    const q = state.admin.search.trim().toLowerCase();
    const f = state.admin.filter;
    const filtered = all.filter((p) => {
      if (f === 'live' && p._source !== 'published') return false;
      if (f === 'draft' && p._source !== 'local') return false;
      if (f === 'featured' && !p.featured) return false;
      if (f === 'sold_out' && normalizeStockStatus(p.stockStatus) !== 'sold_out') return false;
      if ((f === 'Gold' || f === 'Silver' || f === 'Other') && String(p.category || 'Other') !== f) return false;
      if (!q) return true;
      return [p.name, p.category, p.purity, p.sku, p.note].some((v) => String(v || '').toLowerCase().includes(q));
    });

    const sortMode = state.admin.sort;
    filtered.sort((a, b) => {
      if (Boolean(b.featured) !== Boolean(a.featured)) return b.featured ? 1 : -1;
      if (sortMode === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'en');
      if (sortMode === 'price-asc' || sortMode === 'price-desc') {
        const pa = Number(a.price) || 0;
        const pb = Number(b.price) || 0;
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        return sortMode === 'price-asc' ? pa - pb : pb - pa;
      }
      return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0);
    });

    const lbl = $('catalog-count-label');
    if (lbl) lbl.textContent = `Showing ${filtered.length} of ${all.length} item${all.length === 1 ? '' : 's'} (${state.admin.publishedItems.length} live · ${state.admin.localItems.length} local drafts)`;

    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state">${all.length ? 'No jewellery matches this filter.' : 'No jewellery items yet. Upload photos or videos in the Admin Upload Studio above.'}</div>`;
      return;
    }

    grid.innerHTML = filtered.map((item) => {
      const media = resolveDisplayMedia(item);
      const first = media[0];
      const isDraft = item._source === 'local';
      const stock = normalizeStockStatus(item.stockStatus);
      const isSoldOut = stock === 'sold_out';
      const isFeatured = Boolean(item.featured);
      const mediaHtml = first
        ? (first.type === 'video'
            ? `<video src="${escapeHtml(first.src)}" muted playsinline preload="metadata"></video>`
            : `<img src="${escapeHtml(first.src)}" alt="${escapeHtml(item.name)}" loading="lazy" />`)
        : '<div style="display:grid;place-items:center;height:100%;color:var(--text-dim);font-size:0.75rem;">No media</div>';

      const specs = [];
      if (item.purity) specs.push(`<span class="spec-tag">${escapeHtml(item.purity)}</span>`);
      if (Number(item.weight) > 0) specs.push(`<span class="spec-tag tabular">${Number(item.weight).toFixed(3)} g</span>`);
      if (Number(item.makingPct) > 0) specs.push(`<span class="spec-tag tabular">MC ${Number(item.makingPct)}%</span>`);
      if (item.sku) specs.push(`<span class="spec-tag mono">${escapeHtml(item.sku)}</span>`);
      if (stock === 'made_to_order') specs.push('<span class="pill pill-blue" style="padding:0.1rem 0.42rem;font-size:0.62rem;">Made to Order</span>');
      else if (isSoldOut) specs.push('<span class="pill pill-red" style="padding:0.1rem 0.42rem;font-size:0.62rem;">Sold Out</span>');

      const priceHtml = Number(item.price) > 0 ? fmtINR(Number(item.price)) : 'Price on request';

      return `
        <article class="item-card${isSoldOut ? ' is-sold-out' : ''}${isFeatured ? ' is-featured' : ''}">
          <div class="item-media" data-open-lb="${escapeHtml(item.id)}" data-src-type="${item._source}">
            ${mediaHtml}
            <span class="item-badge-tl pill ${isDraft ? 'pill-gold' : 'pill-green'}">${isDraft ? 'Local Draft' : 'Live'}</span>
            ${isFeatured ? '<span class="item-badge-tr pill pill-featured">★ Pick</span>' : (media.length > 1 ? `<span class="item-badge-tr pill">${media.length} files</span>` : '')}
          </div>
          <div class="item-body">
            <div class="item-cat">${escapeHtml(item.category || 'Gold')}</div>
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${specs.length ? `<div class="item-specs">${specs.join('')}</div>` : ''}
            <div class="item-price tabular">${priceHtml}</div>
            ${item.note ? `<div class="item-note">${escapeHtml(item.note)}</div>` : ''}
            <div class="item-actions">
              <button type="button" class="btn btn-ghost btn-xs" data-edit-item="${escapeHtml(item.id)}" data-src-type="${item._source}">Edit</button>
              <button type="button" class="btn btn-ghost btn-xs" data-tag-item="${escapeHtml(item.id)}" data-src-type="${item._source}" title="Printable QR Price Tag">QR Tag</button>
              <button type="button" class="btn btn-ghost btn-xs" data-bill-item="${escapeHtml(item.id)}" data-src-type="${item._source}" title="Add to GST Bill Slip">+ Bill</button>
              ${isDraft ? `<button type="button" class="btn btn-green btn-xs" data-pub-draft="${escapeHtml(item.id)}">Publish Live</button>` : ''}
              <button type="button" class="btn btn-ghost btn-xs" data-wa-item="${escapeHtml(item.id)}" data-src-type="${item._source}">WhatsApp</button>
              <button type="button" class="btn btn-red btn-xs" style="margin-left:auto;" data-del-item="${escapeHtml(item.id)}" data-src-type="${item._source}">Delete</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function findItem(id, src) {
    const pool = src === 'local' ? state.admin.localItems : state.admin.publishedItems;
    return pool.find((x) => x.id === id) || null;
  }

  function openEditModal(id, src) {
    const item = findItem(id, src);
    if (!item) return;
    $('edit-id').value = item.id;
    $('edit-source').value = src;
    $('edit-name').value = item.name || '';
    $('edit-category').value = item.category || 'Gold';
    $('edit-purity').value = item.purity || '';
    $('edit-weight').value = item.weight || '';
    $('edit-making').value = item.makingPct !== undefined ? item.makingPct : 10;
    $('edit-price').value = item.price || '';
    $('edit-sku').value = item.sku || '';
    $('edit-stock').value = normalizeStockStatus(item.stockStatus);
    $('edit-featured').checked = Boolean(item.featured);
    $('edit-note').value = item.note || '';
    $('edit-modal-sub').textContent = src === 'local' ? 'Updates this local draft in IndexedDB.' : 'Publishes updated details straight to catalog/products.json on GitHub.';
    $('edit-modal').classList.remove('hidden');
  }

  function openLightbox(id, src) {
    const item = findItem(id, src);
    if (!item) return;
    revokeLightboxObjectUrls();
    const media = resolveDisplayMedia(item, state.admin.lightboxObjectUrls);
    if (!media.length) return;
    state.admin.lightboxItem = { item, media };
    state.admin.lightboxIdx = 0;
    renderLightbox();
    $('lightbox-modal').classList.remove('hidden');
  }

  function renderLightbox() {
    const ctx = state.admin.lightboxItem;
    if (!ctx) return;
    const cur = ctx.media[state.admin.lightboxIdx] || ctx.media[0];
    $('lb-title').textContent = ctx.item.name;
    $('lb-meta').textContent = [ctx.item.category, ctx.item.purity, ctx.item.weight ? `${ctx.item.weight}g` : '', ctx.item.price ? fmtINR(ctx.item.price) : 'Price on request'].filter(Boolean).join(' · ');
    $('lb-stage').innerHTML = cur.type === 'video'
      ? `<video src="${escapeHtml(cur.src)}" controls playsinline autoplay></video>`
      : `<img src="${escapeHtml(cur.src)}" alt="${escapeHtml(ctx.item.name)}" />`;
    const nav = $('lb-nav');
    if (nav) {
      nav.classList.toggle('hidden', ctx.media.length <= 1);
      $('lb-counter').textContent = `${state.admin.lightboxIdx + 1} / ${ctx.media.length}`;
    }
  }

  // =========================================================================
  // EXCHANGE COMPARISON & MARKET ACCURACY RENDERERS
  // =========================================================================
  function renderExchangeComparison() {
    const body = $('ex-body');
    if (!body) return;
    const empty = $('ex-empty');
    if (!state.prices) {
      body.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');
    const rows = computeExchangeRows();
    const q = state.exchanges.search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => `${r.name} ${r.city || ''} ${r.state || ''} ${r.country}`.toLowerCase().includes(q))
      : rows;

    let cheaper = 0;
    let pricier = 0;
    for (const r of filtered) {
      if (r.isShop) continue;
      if (r.diffAmt < -1) cheaper += 1;
      else if (r.diffAmt > 1) pricier += 1;
    }
    $('ex-stat-total').textContent = `Markets: ${Math.max(0, filtered.length - 1)} of ${EXCHANGE_MARKETS.length - 1}`;
    $('ex-stat-cheaper').textContent = `Cheaper than us: ${cheaper}`;
    $('ex-stat-pricier').textContent = `Pricier than us: ${pricier}`;
    $('ex-updated').textContent = `Live · ${fmtTime(new Date())} IST`;

    body.innerHTML = filtered.map((r) => {
      const atPar = !r.isShop && Math.abs(r.diffAmt) < 1;
      const cls = r.isShop || atPar ? 'diff-zero' : r.diffAmt > 0 ? 'diff-up' : 'diff-down';
      const sign = r.diffAmt > 0 ? '+' : r.diffAmt < 0 ? '−' : '';
      const diffTxt = r.isShop ? 'Reference' : atPar ? '±0.00%' : `${sign}${Math.abs(r.diffPct).toFixed(2)}%`;
      const unitLabel = r.quoteMetal === 'gold' ? '/g' : '/kg';
      const sym = r.currency === 'INR' ? '₹' : `${r.currency} `;
      return `
        <tr class="${r.isShop ? 'row-ref' : ''}">
          <td>
            <div style="font-weight:700;color:var(--gold-cream);">${escapeHtml(r.name)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">${escapeHtml([r.city, r.country].filter(Boolean).join(' · '))}</div>
          </td>
          <td class="tabular">
            <div style="font-weight:700;">${fmtINR(r.theirInr)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">${sym}${Number(r.local).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unitLabel}</div>
          </td>
          <td style="text-align:right;" class="tabular">
            <div class="${cls}">${diffTxt}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">${r.isShop ? 'Your shop price' : atPar ? 'At par' : `${sign}${fmtINR(Math.abs(r.diffAmt))}`}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function fetchMarketAccuracy(isManual = false) {
    const ma = state.accuracy;
    if (ma.loading || !state.prices) return;
    ma.loading = true;
    try {
      const metal = ma.metal === 'silver' ? 'silver' : 'gold';
      const shopBase = metal === 'gold' ? state.prices.gold999ExGst : state.prices.silver999ExGst;
      const usdInr = state.live.usdInr || state.prices.usdInr;
      ma.shopBase = shopBase;

      const metalFeeds = ACCURACY_LIVE_FEEDS.filter((f) => f.metal === metal);
      const results = await Promise.all(metalFeeds.map(async (f) => {
        try {
          const json = await fetchWithTimeout(f.url, 6000);
          const usdPrice = f.parse(json);
          if (spotInBand(usdPrice, metal)) {
            const perGram = usdPrice / TROY_OZ_TO_GRAMS;
            const theirInr = (metal === 'gold' ? perGram * usdInr * 10 : perGram * 1000 * usdInr) * importDutyMultiplier(metal);
            return { ...f, type: 'live', valid: true, theirInr, local: usdPrice, localUnit: '/oz', usdPrice };
          }
        } catch { /* failed feed */ }
        return { ...f, type: 'live', valid: false, theirInr: null, local: NaN, localUnit: '/oz', usdPrice: NaN };
      }));

      for (const m of EXCHANGE_MARKETS) {
        if (m.isShop) continue;
        if (m.metal !== metal && m.metal !== 'both') continue;
        const theirInr = shopBase * (1 + m.basisPct / 100);
        results.push({
          id: `ind-${m.id}`, name: m.name, city: m.city, country: m.country, currency: 'INR',
          type: 'indicative', valid: true, theirInr,
          local: metal === 'gold' ? theirInr / 10 : theirInr / 1000,
          localUnit: '/g',
          usdPrice: NaN
        });
      }

      results.sort((a, b) => (Number.isFinite(b.theirInr) ? b.theirInr : -Infinity) - (Number.isFinite(a.theirInr) ? a.theirInr : -Infinity));
      const liveUsd = results.filter((r) => r.valid && r.type === 'live').map((r) => r.usdPrice);
      const consensusUsd = median(liveUsd);
      const consensusInr = consensusUsd
        ? (consensusUsd / TROY_OZ_TO_GRAMS) * (metal === 'gold' ? 10 : 1000) * usdInr * importDutyMultiplier(metal)
        : null;

      ma.feeds = results;
      ma.consensusUsd = consensusUsd;
      ma.consensus = consensusInr;
      ma.liveCount = liveUsd.length;
      ma.variancePct = consensusInr && shopBase > 0 ? ((shopBase - consensusInr) / consensusInr) * 100 : 0;
      ma.lastFetch = new Date();
      if (isManual) showToast(`Audited ${ma.liveCount} live feeds across ${results.length} markets.`, 'success');
    } finally {
      ma.loading = false;
    }
  }

  function renderMarketAccuracy() {
    const ma = state.accuracy;
    const list = $('acc-list');
    const empty = $('acc-empty');
    if (!list) return;
    renderStatutoryNotice();

    const metal = ma.metal === 'silver' ? 'silver' : 'gold';
    const cal = metal === 'gold' ? ma.calibPctGold : ma.calibPctSilver;
    $('btn-reset-calib')?.classList.toggle('hidden', !cal);
    if ($('acc-stat-unit')) $('acc-stat-unit').textContent = metal === 'gold' ? 'Per 10g' : 'Per 1 kg';

    if (!state.prices || !ma.feeds.length) {
      list.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');
    $('acc-stat-shop').textContent = fmtINR(ma.shopBase);
    $('acc-stat-consensus').textContent = ma.consensus ? fmtINR(ma.consensus) : '—';
    const vTxt = `${ma.variancePct >= 0 ? '+' : ''}${ma.variancePct.toFixed(2)}%`;
    $('acc-stat-variance').textContent = vTxt;
    $('acc-stat-live').textContent = `${ma.liveCount} live · ${ma.feeds.length} total`;
    $('acc-updated').textContent = ma.lastFetch ? `${fmtTime(ma.lastFetch)} IST` : '—';
    $('kpi-variance').textContent = vTxt;
    $('kpi-variance-sub').textContent = `${metal.toUpperCase()} · ${ma.liveCount} live feeds`;

    list.innerHTML = ma.feeds.map((r) => {
      const ok = r.valid && Number.isFinite(r.theirInr);
      const pct = ok && ma.shopBase > 0 ? ((r.theirInr - ma.shopBase) / ma.shopBase) * 100 : 0;
      const pillCls = !ok ? 'pill-red' : r.type === 'live' ? 'pill-green' : '';
      const pillTxt = !ok ? 'Failed' : r.type === 'live' ? 'Live' : 'Indicative';
      const diffCls = !ok ? '' : pct > 0 ? 'diff-up' : pct < 0 ? 'diff-down' : 'diff-zero';
      return `
        <div class="acc-row ${!ok ? 'is-failed' : r.type === 'live' ? 'is-live' : ''}">
          <div>
            <div style="font-size:0.8rem;font-weight:700;color:var(--gold-cream);">${escapeHtml(r.name)}</div>
            <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.15rem;font-size:0.68rem;color:var(--text-muted);">
              <span>${escapeHtml([r.city, r.country].filter(Boolean).join(' · '))}</span>
              <span class="pill ${pillCls}" style="padding:0.06rem 0.42rem;font-size:0.6rem;">${pillTxt}</span>
            </div>
          </div>
          <div class="tabular" style="font-size:0.8rem;font-weight:700;">
            ${ok ? fmtINR(r.theirInr) : '—'}
            <div style="font-size:0.66rem;font-weight:500;color:var(--text-muted);">${ok ? `${r.currency === 'INR' ? '₹' : '$'} ${Number(r.local).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${r.localUnit}` : 'Unreachable'}</div>
          </div>
          <div class="tabular ${diffCls}" style="font-size:0.8rem;">${ok ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}</div>
        </div>
      `;
    }).join('');
  }

  function calibrateToConsensus() {
    const ma = state.accuracy;
    if (!ma.consensusUsd || !state.prices) {
      showToast('Run "Audit Feeds" first to compute live consensus.', 'alert');
      return;
    }
    const metal = ma.metal === 'silver' ? 'silver' : 'gold';
    const spot = metal === 'gold' ? state.live.spotGold : state.live.spotSilver;
    if (!spot || spot <= 0) return;
    let pct = ((ma.consensusUsd - spot) / spot) * 100;
    pct = Math.max(-8, Math.min(8, pct));
    if (metal === 'gold') ma.calibPctGold = pct;
    else ma.calibPctSilver = pct;
    repriceAndRender(false);
    ma.shopBase = metal === 'gold' ? state.prices.gold999ExGst : state.prices.silver999ExGst;
    ma.variancePct = ma.consensus ? ((ma.shopBase - ma.consensus) / ma.consensus) * 100 : 0;
    renderMarketAccuracy();
    showToast(`Calibrated ${metal} by ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% to match exchange consensus.`, 'success');
  }

  // =========================================================================
  // COUNTER CALCULATORS
  // =========================================================================
  function updateCalculators() {
    if (!state.prices) return;
    const q = computeQuoteMath({
      metal: $('calc-metal')?.value || '22K',
      weight: $('calc-weight')?.value,
      unit: $('calc-unit')?.value || 'g',
      makingVal: $('calc-making')?.value,
      makingType: $('calc-making-type')?.value || 'pct',
      includeGst: Boolean($('calc-gst')?.checked)
    });
    if (q) {
      $('q-base').textContent = fmtINR(q.baseValue);
      $('q-making-lbl').textContent = q.makingLabel;
      $('q-making').textContent = fmtINR(q.makingCharges);
      $('q-gst').textContent = fmtINR(q.gstAmount);
      $('q-total').textContent = fmtINR(q.grandTotal);
    }

    const ex = computeOldExchangeMath({
      metal: state.exCalcMetal,
      purity: $('excalc-purity')?.value,
      weight: $('excalc-weight')?.value,
      stone: $('excalc-stone')?.value,
      hallmarked: Boolean($('excalc-hallmark')?.checked),
      newBill: $('excalc-newbill')?.value
    });
    if (ex) {
      $('exq-netg').textContent = `${ex.netGrams.toFixed(2)} g`;
      $('exq-gross').textContent = fmtINR(ex.grossValue);
      $('exq-ded-pct').textContent = `${ex.deductPct}%`;
      $('exq-ded').textContent = fmtINR(ex.deductAmount);
      $('exq-net').textContent = fmtINR(ex.netValue);
      const bRow = $('exq-balance-row');
      if (bRow) {
        bRow.classList.toggle('hidden', !ex.hasBill);
        if (ex.hasBill) {
          $('exq-balance').textContent = ex.balance >= 0
            ? `Pay ${fmtINR(ex.balance)}`
            : `Refund ${fmtINR(Math.abs(ex.balance))}`;
        }
      }
    }
  }

  // =========================================================================
  // ADMIN SUITE: GST BILL SLIP, ORDER BOOK, QR PRICE TAG & EXPORTS
  // =========================================================================
  function nextBillNumber(bump = false) {
    const year = todayIstIso().slice(0, 4);
    let seq = Math.max(1, Number(lsGet(STORAGE_KEYS.billSeq, '1')) || 1);
    if (bump) {
      seq += 1;
      lsSet(STORAGE_KEYS.billSeq, String(seq));
    }
    return `SJ-${year}-${String(seq).padStart(3, '0')}`;
  }

  function populateBillCatalogPicker() {
    const sel = $('bill-pick-catalog');
    if (!sel) return;
    const all = [
      ...state.admin.publishedItems.map((x) => ({ ...x, _src: 'Live' })),
      ...state.admin.localItems.map((x) => ({ ...x, _src: 'Draft' }))
    ];
    sel.innerHTML = '<option value="">+ Pick from Catalogue…</option>' + all.map((p) => (
      `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.purity || p.category || 'Gold')}${Number(p.weight) > 0 ? ` · ${Number(p.weight).toFixed(2)}g` : ''})</option>`
    )).join('');
  }

  function syncBillMetaFromInputs() {
    if ($('bill-doc-type')) state.bill.docType = $('bill-doc-type').value || 'GST Estimate';
    if ($('bill-number')) {
      if (!$('bill-number').value.trim()) $('bill-number').value = state.bill.billNo || nextBillNumber(false);
      state.bill.billNo = $('bill-number').value.trim();
    }
    if ($('bill-cust-name')) state.bill.customerName = $('bill-cust-name').value.trim();
    if ($('bill-cust-phone')) state.bill.customerPhone = $('bill-cust-phone').value.trim();
    if ($('bill-old-exchange')) state.bill.oldExchange = Math.max(0, Number($('bill-old-exchange').value) || 0);
    if ($('bill-discount')) state.bill.discount = Math.max(0, Number($('bill-discount').value) || 0);
    if ($('bill-advance')) state.bill.advance = Math.max(0, Number($('bill-advance').value) || 0);
    if ($('bill-notes')) state.bill.notes = $('bill-notes').value.trim();
    if ($('bill-include-gst')) state.bill.includeGst = Boolean($('bill-include-gst').checked);
  }

  function renderBillSlipHtml(billDraft, totals) {
    const docType = escapeHtml(billDraft.docType || 'GST Estimate');
    const billNo = escapeHtml(billDraft.billNo || nextBillNumber(false));
    const cust = escapeHtml(billDraft.customerName || 'Walk-in Customer');
    const phone = escapeHtml(billDraft.customerPhone || '');
    const dateStr = escapeHtml(todayIstIso());

    const rowsHtml = totals.lines.length
      ? totals.lines.map((ln, idx) => `
          <tr>
            <td>${idx + 1}. <strong>${escapeHtml(ln.desc)}</strong><br/><span style="font-size:0.68rem;color:#555;">${escapeHtml(ln.metal)}${ln.huid ? ` · HUID: ${escapeHtml(ln.huid)}` : ''} · @${fmtINR(ln.ratePerGram)}/g</span></td>
            <td style="text-align:right;">${ln.weight.toFixed(3)}g</td>
            <td style="text-align:right;">${fmtINR(ln.metalValue)}</td>
            <td style="text-align:right;">${fmtINR(ln.makingCharges)}<br/><span style="font-size:0.64rem;color:#666;">(${escapeHtml(ln.makingLabel)})</span></td>
            <td style="text-align:right;font-weight:700;">${fmtINR(ln.taxable)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" style="text-align:center;color:#666;padding:0.9rem;">Add a jewellery item on the left to preview itemised slip</td></tr>';

    return `
      <div class="bill-head">
        <div>
          <h4>SATYANARAYAN JEWELLERS</h4>
          <div class="bill-meta">Naya Sarak / Cuttack Showroom, Odisha · BIS Hallmarked</div>
          <div class="bill-meta">GSTIN: <strong>${SHOP_GSTIN}</strong></div>
        </div>
        <div class="bill-meta" style="text-align:right;">
          <div><strong>${docType}</strong></div>
          <div>No: <strong>${billNo}</strong></div>
          <div>Date: ${dateStr}</div>
        </div>
      </div>
      <div style="font-size:0.75rem;margin-bottom:0.55rem;display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
        <span>Customer: <strong>${cust}</strong>${phone ? ` · ${phone}` : ''}</span>
        <span>Total Net Wt: <strong>${totals.totalWeight.toFixed(3)} g</strong></span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item &amp; Purity</th>
            <th style="text-align:right;">Net Wt</th>
            <th style="text-align:right;">Metal ₹</th>
            <th style="text-align:right;">Making</th>
            <th style="text-align:right;">Taxable</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="bill-totals">
        <div class="bill-row"><span>Metal + Making Subtotal</span><strong>${fmtINR(totals.metalSubtotal + totals.makingSubtotal)}</strong></div>
        ${totals.discount > 0 ? `<div class="bill-row"><span>Less Special Discount</span><strong>-${fmtINR(totals.discount)}</strong></div>` : ''}
        <div class="bill-row"><span>Taxable Value</span><strong>${fmtINR(totals.taxableValue)}</strong></div>
        ${totals.gstTotal > 0 ? `<div class="bill-row"><span>CGST + SGST (${fmtINR(totals.cgst)} + ${fmtINR(totals.sgst)})</span><strong>+${fmtINR(totals.gstTotal)}</strong></div>` : '<div class="bill-row"><span>GST</span><strong>Excluded (Estimate)</strong></div>'}
        <div class="bill-row"><span><strong>Gross Total</strong></span><strong>${fmtINR(totals.grossTotal)}</strong></div>
        ${totals.oldExchange > 0 ? `<div class="bill-row"><span>Less Old Gold/Silver Exchange</span><strong>-${fmtINR(totals.oldExchange)}</strong></div>` : ''}
        ${totals.advance > 0 ? `<div class="bill-row"><span>Less Advance Paid</span><strong>-${fmtINR(totals.advance)}</strong></div>` : ''}
        <div class="bill-row is-grand"><span>${totals.netPayable >= 0 ? 'Net Balance Payable' : 'Net Refund Due'}</span><span>${fmtINR(Math.abs(totals.netPayable))}</span></div>
      </div>
      ${billDraft.notes ? `<div style="margin-top:0.55rem;font-size:0.7rem;color:#444;">Remark: ${escapeHtml(billDraft.notes)}</div>` : ''}
      <div style="margin-top:0.65rem;padding-top:0.45rem;border-top:1px dashed #ccc;font-size:0.65rem;color:#666;display:flex;justify-content:space-between;">
        <span>Subject to Cuttack jurisdiction · E.&amp;O.E.</span>
        <span>Authorised Signatory</span>
      </div>
    `;
  }

  function renderBillSlip() {
    syncBillMetaFromInputs();
    const totals = computeBillTotals(state.bill);
    const listEl = $('bill-lines-list');
    if (listEl) {
      if (!totals.lines.length) {
        listEl.innerHTML = '<div class="empty-state" style="padding:0.85rem;font-size:0.75rem;">No items added yet. Fill item details above or pick from Catalogue.</div>';
      } else {
        listEl.innerHTML = totals.lines.map((ln) => `
          <div class="bill-line-card">
            <div style="min-width:0;">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text);">${escapeHtml(ln.desc)}</div>
              <div class="bill-line-meta tabular">${escapeHtml(ln.metal)} · ${ln.weight.toFixed(3)}g @ ${fmtINR(ln.ratePerGram)}/g · Making ${escapeHtml(ln.makingLabel)}${ln.huid ? ` · HUID ${escapeHtml(ln.huid)}` : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.45rem;flex-shrink:0;">
              <strong class="tabular" style="font-size:0.82rem;color:var(--gold-light);">${fmtINR(ln.lineTotal)}</strong>
              <button type="button" class="btn btn-red btn-xs" data-del-bill-line="${escapeHtml(ln.id)}" aria-label="Remove line">✕</button>
            </div>
          </div>
        `).join('');
      }
    }
    const paper = $('bill-preview-paper');
    if (paper) paper.innerHTML = renderBillSlipHtml(state.bill, totals);
  }

  function addCatalogItemToBill(item) {
    if (!item) return;
    const metal = inferMetalCode(item.category, item.purity);
    const w = Math.max(0, Number(item.weight) || 0);
    const useFlatPrice = !(w > 0) && Number(item.price) > 0;
    state.bill.lines.push({
      id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      desc: item.name || 'Jewellery Item',
      metal,
      huid: item.sku || '',
      weight: w,
      ratePerGram: 0,
      makingVal: useFlatPrice ? Math.round(Number(item.price) / 1.03) : (Number(item.makingPct) > 0 ? Number(item.makingPct) : 10),
      makingType: useFlatPrice ? 'flat' : 'pct'
    });
    switchView('settings');
    switchSubtab('bill');
    showToast(`Added "${item.name}" to GST Bill Slip.`, 'success');
  }

  function printHtmlInSlipSheet(innerHtml) {
    const sheet = $('admin-print-sheet');
    if (!sheet) { window.print(); return; }
    sheet.innerHTML = innerHtml;
    document.body.classList.add('printing-slip');
    const cleanup = () => {
      document.body.classList.remove('printing-slip');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1200);
  }

  function loadOrderBook() {
    try {
      const parsed = JSON.parse(lsGet(STORAGE_KEYS.orderBook, '[]'));
      if (Array.isArray(parsed)) {
        state.orders.items = parsed.map(sanitizeOrderRecord).filter(Boolean);
      }
    } catch {
      state.orders.items = [];
    }
    updateOrderBadges();
  }

  function persistOrderBook() {
    lsSet(STORAGE_KEYS.orderBook, JSON.stringify(state.orders.items));
    updateOrderBadges();
  }

  function updateOrderBadges() {
    const activeCount = state.orders.items.filter((o) => o.status !== 'Delivered').length;
    ['top-orders-badge', 'desk-orders-badge', 'subtab-orders-badge'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = String(activeCount);
      el.classList.toggle('hidden', activeCount === 0);
    });
  }

  function renderOrderBook() {
    updateOrderBadges();
    const listEl = $('ord-list');
    const subEl = $('ord-summary-sub');
    const activeOrders = state.orders.items.filter((o) => o.status !== 'Delivered');
    const totalAdvance = activeOrders.reduce((acc, o) => acc + (Number(o.advance) || 0), 0);
    if (subEl) {
      subEl.textContent = `${activeOrders.length} active order${activeOrders.length === 1 ? '' : 's'} · ${fmtINR(totalAdvance)} advance held`;
    }
    if (!listEl) return;

    const today = todayIstIso();
    const f = state.orders.filter;
    const filtered = state.orders.items.filter((o) => {
      if (f === 'active') return o.status !== 'Delivered';
      if (f === 'Ready') return o.status === 'Ready';
      if (f === 'Delivered') return o.status === 'Delivered';
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty-state" style="padding:1.25rem;">No customer orders in this view. Record custom orders &amp; advance rate-locks on the left.</div>';
      return;
    }

    listEl.innerHTML = filtered.map((o) => {
      const isDelivered = o.status === 'Delivered';
      const isOverdue = !isDelivered && o.dueDate && o.dueDate < today;
      const statusPill = o.status === 'Ready'
        ? 'pill-green'
        : o.status === 'Karigar'
          ? 'pill-blue'
          : o.status === 'Delivered'
            ? ''
            : 'pill-gold';
      return `
        <div class="order-card${isOverdue ? ' is-overdue' : ''}${isDelivered ? ' is-delivered' : ''}">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.2rem;">
              <strong style="font-size:0.84rem;">${escapeHtml(o.customerName)}</strong>
              <span class="pill ${statusPill}" style="padding:0.08rem 0.45rem;font-size:0.62rem;">${escapeHtml(o.status)}</span>
              ${isOverdue ? '<span class="pill pill-red" style="padding:0.08rem 0.42rem;font-size:0.6rem;">Overdue</span>' : ''}
            </div>
            <div style="font-size:0.78rem;color:var(--text-2);font-weight:600;">${escapeHtml(o.item)}</div>
            <div class="bill-line-meta tabular">
              ${escapeHtml(o.metal)}${o.weight > 0 ? ` · ~${Number(o.weight).toFixed(2)}g` : ''}
              ${o.lockedRate > 0 ? ` · Locked @ ${fmtINR(o.lockedRate)}/g` : ''}
              ${o.advance > 0 ? ` · Adv: ${fmtINR(o.advance)}` : ''}
              ${o.dueDate ? ` · Due: ${escapeHtml(o.dueDate)}` : ''}
            </div>
            ${o.note ? `<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.2rem;">${escapeHtml(o.note)}</div>` : ''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;">
            <select class="select" data-ord-status="${escapeHtml(o.id)}" style="width:auto;padding:0.25rem 0.45rem;font-size:0.7rem;" aria-label="Order status">
              <option value="Booked"${o.status === 'Booked' ? ' selected' : ''}>Booked</option>
              <option value="Karigar"${o.status === 'Karigar' ? ' selected' : ''}>Karigar</option>
              <option value="Ready"${o.status === 'Ready' ? ' selected' : ''}>Ready</option>
              <option value="Delivered"${o.status === 'Delivered' ? ' selected' : ''}>Delivered</option>
            </select>
            <button type="button" class="btn btn-green btn-xs" data-ord-wa="${escapeHtml(o.id)}">WhatsApp</button>
            <button type="button" class="btn btn-ghost btn-xs" data-ord-to-bill="${escapeHtml(o.id)}" title="Convert order to GST Bill Slip">→ Bill</button>
            <button type="button" class="btn btn-red btn-xs" data-ord-del="${escapeHtml(o.id)}" aria-label="Delete order">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function buildTagCardHtml(item) {
    const qrTarget = `https://satyanarayanjewellery.github.io/shop/#products?sku=${encodeURIComponent(item.sku || item.id)}`;
    const qrSvg = generateQrSvg(qrTarget, 96);
    const priceLine = Number(item.price) > 0 ? fmtINR(Number(item.price)) : 'Price on Request';
    return `
      <div class="tag-preview-card">
        <div class="tag-qr">${qrSvg}</div>
        <div class="tag-info">
          <div class="tag-brand">SATYANARAYAN JEWELLERS</div>
          <div class="tag-title">${escapeHtml(item.name)}</div>
          <div class="tag-meta">
            ${escapeHtml(item.category || 'Gold')}${item.purity ? ` · ${escapeHtml(item.purity)}` : ''}<br/>
            ${Number(item.weight) > 0 ? `Net Wt: <strong>${Number(item.weight).toFixed(3)} g</strong>` : 'BIS Hallmarked'}
            ${item.sku ? `<br/>SKU: <strong>${escapeHtml(item.sku)}</strong>` : ''}
          </div>
          <div class="tag-price">${priceLine}</div>
        </div>
      </div>
    `;
  }

  function openTagModal(id, src) {
    const item = findItem(id, src);
    if (!item) return;
    state.admin.tagItem = item;
    const stage = $('tag-preview-stage');
    if (stage) stage.innerHTML = buildTagCardHtml(item);
    $('tag-modal')?.classList.remove('hidden');
  }

  function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // =========================================================================
  // PWA LIFECYCLE (INSTALL PROMPT, SW UPDATE & DIAGNOSTICS)
  // =========================================================================
  function isStandaloneMode() {
    return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || (typeof navigator !== 'undefined' && navigator.standalone === true);
  }

  function updateInstallUI() {
    if (!state.pwa.deferredPrompt && typeof window !== 'undefined' && window.__adminDeferredPrompt) {
      state.pwa.deferredPrompt = window.__adminDeferredPrompt;
    }
    const installed = isStandaloneMode();
    const hasPrompt = Boolean(state.pwa.deferredPrompt);
    $('btn-install-header')?.classList.toggle('hidden', installed || !hasPrompt);
    $('btn-install-settings')?.classList.toggle('hidden', installed || !hasPrompt);
    $('auth-install-wrap')?.classList.toggle('hidden', installed || !hasPrompt);
    $('auth-install-help')?.classList.toggle('hidden', installed);
    const status = $('pwa-install-status');
    if (status) {
      status.textContent = installed
        ? 'SJ Admin Desk is installed and running in standalone app mode.'
        : hasPrompt
          ? 'Ready to install as a standalone app on this device.'
          : 'Open directly in Chrome (not an in-app tab). If an older SJ Price Desk copy is installed, remove it once, then install both via their in-app Install buttons (or Chrome 157+).';
    }
    updateDiagnostics();
  }

  async function triggerPwaInstall() {
    const promptEvt = state.pwa.deferredPrompt;
    if (!promptEvt) return;
    promptEvt.prompt();
    const choice = await promptEvt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    state.pwa.deferredPrompt = null;
    if (typeof window !== 'undefined') window.__adminDeferredPrompt = null;
    updateInstallUI();
    if (choice && choice.outcome === 'accepted') {
      showToast('Installing SJ Admin Desk to your home screen!', 'success');
    }
  }

  function updateDiagnostics() {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    const swStatus = state.pwa.swReg
      ? (state.pwa.swReg.active ? 'Active (offline ready · scope /admin/)' : 'Installing…')
      : ('serviceWorker' in navigator ? 'Not registered' : 'Unsupported');
    set('diag-version', ADMIN_APP_VERSION);
    set('diag-sw', swStatus);
    set('diag-display', isStandaloneMode() ? 'Installed Standalone PWA' : 'Browser Tab');
    set('diag-net', navigator.onLine ? 'Online' : 'Offline');
    set('sec-session-meta', `Signed in as @${state.admin.login || 'admin'} · ${CATALOG_REPO_ADMIN}/${CATALOG_REPO_NAME} (${CATALOG_REPO_BRANCH})`);
  }

  function registerAdminServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure) return;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((reg) => {
      state.pwa.swReg = reg;
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
      if (reg.waiting) {
        state.pwa.waitingWorker = reg.waiting;
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        $('sw-update-banner')?.classList.remove('hidden');
      }
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            state.pwa.waitingWorker = next;
            next.postMessage({ type: 'SKIP_WAITING' });
            $('sw-update-banner')?.classList.remove('hidden');
          }
        });
      });
      updateDiagnostics();
    }).catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  // =========================================================================
  // AUTH GATE & BOOT FLOW
  // =========================================================================
  let liveStarted = false;

  function unlockWorkspace({ token, login, offline = false }) {
    state.admin.token = token;
    state.admin.login = login;
    state.admin.unlocked = true;
    state.admin.offlineSession = offline;
    $('auth-gate')?.classList.add('hidden');
    $('admin-app')?.classList.remove('hidden');
    $('admin-user-label').textContent = `@${login}`;
    const pill = $('admin-user-pill');
    if (pill) {
      pill.className = `pill ${offline ? 'pill-gold' : 'pill-green'}`;
      pill.innerHTML = `<span class="dot ${offline ? 'dot-gold' : 'dot-green'}"></span><span>@${escapeHtml(login)}${offline ? ' (Offline)' : ''}</span>`;
    }
    updateDiagnostics();

    if (!liveStarted) {
      liveStarted = true;
      loadStatutoryRates(true);
      hydrateCachedRates();
      loadOrderBook();
      connectLiveWebSockets();
      syncMetalsRest(false);
      scheduleFxHeartbeat();
      renderClockAndMarket();
      setInterval(renderClockAndMarket, 1000);
      setInterval(renderLiveStatusBadge, 10000);
    } else {
      loadOrderBook();
    }
    refreshAllCatalog();

    // Honor PWA shortcut hash (#catalog, #exchanges, #accuracy, #settings)
    const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (['desk', 'catalog', 'exchanges', 'accuracy', 'settings'].includes(hash)) {
      switchView(hash);
    } else {
      switchView('desk');
    }
  }

  function lockWorkspace(clearToken = false) {
    if (clearToken) {
      storeGitHubToken('', false);
      lsRemove(ADMIN_VERIFIED_META_KEY);
    }
    const tokenInp = $('auth-token-input');
    if (tokenInp) {
      tokenInp.value = '';
      tokenInp.type = 'password';
    }
    const toggleBtn = $('btn-auth-toggle-vis');
    if (toggleBtn) toggleBtn.textContent = 'Show';
    state.admin.unlocked = false;
    state.admin.offlineSession = false;
    state.admin.token = '';
    if (clearToken) state.admin.login = '';
    revokeLightboxObjectUrls();
    clearPendingFiles();
    $('admin-app')?.classList.add('hidden');
    $('auth-gate')?.classList.remove('hidden');
    $('auth-error')?.classList.add('hidden');
  }

  async function tryAutoRestoreSession() {
    const saved = getStoredGitHubToken();
    if (!saved) return;
    $('auth-checking')?.classList.remove('hidden');
    try {
      const verified = await verifyGitHubToken(saved);
      saveVerifiedMeta(verified.token, verified.login);
      unlockWorkspace({ token: verified.token, login: verified.login, offline: false });
    } catch (err) {
      if (err && err.authError) {
        storeGitHubToken('', false);
        lsRemove(ADMIN_VERIFIED_META_KEY);
        const errEl = $('auth-error');
        if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
      } else {
        // Offline resilience: allow cached admin desk ONLY if this exact token was verified before.
        const meta = readVerifiedMeta();
        if (meta && meta.fp === tokenFingerprint(saved)) {
          unlockWorkspace({ token: saved, login: meta.login || CATALOG_REPO_ADMIN, offline: true });
        }
      }
    } finally {
      $('auth-checking')?.classList.add('hidden');
    }
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================
  function bindEvents() {
    // Auth Gate
    $('btn-auth-toggle-vis')?.addEventListener('click', () => {
      const inp = $('auth-token-input');
      const btn = $('btn-auth-toggle-vis');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    });

    $('auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = $('auth-error');
      const btn = $('btn-auth-submit');
      errEl.classList.add('hidden');
      btn.disabled = true;
      btn.textContent = 'Verifying…';
      try {
        const raw = $('auth-token-input').value;
        const remember = Boolean($('auth-remember').checked);
        const verified = await verifyGitHubToken(raw);
        storeGitHubToken(verified.token, remember);
        if (remember) saveVerifiedMeta(verified.token, verified.login);
        else lsRemove(ADMIN_VERIFIED_META_KEY);
        unlockWorkspace({ token: verified.token, login: verified.login, offline: false });
        showToast(`Welcome back, @${verified.login}!`, 'success');
      } catch (err) {
        errEl.textContent = err?.message || 'Verification failed.';
        errEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Verify & Open Admin Desk';
      }
    });

    // Header & Nav
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.querySelectorAll('[data-jump-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.jumpView));
    });
    document.querySelectorAll('[data-jump-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchView('settings');
        switchSubtab(btn.dataset.jumpSubtab);
      });
    });
    document.querySelectorAll('[data-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => switchSubtab(btn.dataset.subtab));
    });

    $('btn-lock-admin')?.addEventListener('click', () => { lockWorkspace(false); showToast('Admin Desk locked.', 'info'); });
    $('btn-sec-lock')?.addEventListener('click', () => { lockWorkspace(false); showToast('Admin Desk locked.', 'info'); });
    $('btn-sec-disconnect')?.addEventListener('click', () => {
      openConfirm('Disconnect Admin Token?', 'Your GitHub token will be removed from this device and you will need to paste it again to sign in.', 'Disconnect', () => {
        closeConfirm();
        lockWorkspace(true);
        showToast('GitHub token disconnected.', 'info');
      });
    });

    // Desk controls & Broadcast
    $('desk-city')?.addEventListener('change', (e) => {
      if (CITIES[e.target.value]) {
        state.cityId = e.target.value;
        repriceAndRender(false);
        showToast(`Location set to ${CITIES[state.cityId].name}.`, 'success');
      }
    });
    $('btn-mode-inr')?.addEventListener('click', () => {
      state.marketMode = 'INR';
      $('btn-mode-inr').classList.add('is-active');
      $('btn-mode-usd').classList.remove('is-active');
      $('inr-board').classList.remove('hidden');
      $('usd-board').classList.add('hidden');
    });
    $('btn-mode-usd')?.addEventListener('click', () => {
      state.marketMode = 'USD';
      $('btn-mode-usd').classList.add('is-active');
      $('btn-mode-inr').classList.remove('is-active');
      $('usd-board').classList.remove('hidden');
      $('inr-board').classList.add('hidden');
    });
    $('btn-refresh-rates')?.addEventListener('click', () => {
      connectLiveWebSockets();
      syncMetalsRest(true);
    });
    $('btn-copy-rates')?.addEventListener('click', async () => {
      const text = buildRatesShareText();
      if (!text) return showToast('Waiting for live rates…', 'alert');
      try {
        await navigator.clipboard.writeText(text);
        showToast('Formatted Cuttack rates copied to clipboard.', 'success');
      } catch { showToast('Clipboard unavailable on this browser.', 'alert'); }
    });
    $('btn-share-wa')?.addEventListener('click', () => {
      const text = buildRatesShareText();
      if (!text) return showToast('Waiting for live rates…', 'alert');
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    });
    $('btn-native-share')?.addEventListener('click', async () => {
      const text = buildRatesShareText();
      if (!text) return showToast('Waiting for live rates…', 'alert');
      if (navigator.share) {
        try { await navigator.share({ title: 'Satyanarayan Jewellers Live Rates', text }); return; } catch { /* cancelled */ }
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied rates (native Share Sheet unavailable here).', 'info');
      } catch { /* ignore */ }
    });
    $('btn-print-rates')?.addEventListener('click', () => window.print());

    // Upload Studio
    const dz = $('upload-dropzone');
    const fileInput = $('upload-media-input');
    const camInput = $('upload-camera-input');
    $('btn-pick-files')?.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });
    $('btn-take-photo')?.addEventListener('click', (e) => { e.stopPropagation(); camInput?.click(); });
    dz?.addEventListener('click', () => fileInput?.click());
    dz?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); } });
    dz?.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-dragover'); });
    dz?.addEventListener('dragleave', () => dz.classList.remove('is-dragover'));
    dz?.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('is-dragover');
      addPendingFiles(e.dataTransfer?.files);
    });
    fileInput?.addEventListener('change', (e) => { addPendingFiles(e.target.files); e.target.value = ''; });
    camInput?.addEventListener('change', (e) => { addPendingFiles(e.target.files); e.target.value = ''; });

    $('upload-previews')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-pending]');
      if (!btn) return;
      const idx = Number(btn.dataset.removePending);
      if (state.admin.pendingFiles[idx]) {
        try { URL.revokeObjectURL(state.admin.pendingFiles[idx].previewUrl); } catch { /* ignore */ }
        state.admin.pendingFiles.splice(idx, 1);
        renderPendingFiles();
      }
    });

    document.querySelectorAll('[data-fill-purity]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = $('f-purity');
        if (inp) inp.value = btn.dataset.fillPurity;
        if (btn.dataset.fillPurity.toLowerCase().includes('silver') || btn.dataset.fillPurity === '925 Sterling') {
          if ($('f-category')) $('f-category').value = 'Silver';
        } else if ($('f-category')) {
          $('f-category').value = 'Gold';
        }
        updateAutoPriceHint();
      });
    });

    ['f-category', 'f-purity', 'f-weight', 'f-making'].forEach((id) => {
      $(id)?.addEventListener('input', updateAutoPriceHint);
      $(id)?.addEventListener('change', updateAutoPriceHint);
    });

    $('btn-f-autoprice')?.addEventListener('click', () => {
      if (!state.prices) return showToast('Waiting for live bullion rates…', 'alert');
      const w = Math.max(0, Number($('f-weight')?.value) || 0);
      if (!(w > 0)) return showToast('Enter item weight (g) first to auto-calculate price.', 'alert');
      const est = computeAutoItemPrice({
        category: $('f-category')?.value || 'Gold',
        purity: ($('f-purity')?.value || '').trim(),
        weight: w,
        makingPct: Math.max(0, Number($('f-making')?.value) || 0),
        includeGst: true
      });
      if (!est) return showToast('Could not calculate live estimate.', 'alert');
      if ($('f-price')) $('f-price').value = String(est.grandTotal);
      updateAutoPriceHint();
      showToast(`Filled live ${est.metal} price: ${fmtINR(est.grandTotal)}`, 'success');
    });

    $('btn-reprice-inventory')?.addEventListener('click', () => {
      if (!state.prices) return showToast('Waiting for live bullion rates…', 'alert');
      openConfirm(
        'Live Reprice All Weighted Items?',
        'Updates the published price of every catalogue item with Weight > 0 using today\'s live Cuttack bullion rate + its Making % + statutory GST.',
        'Reprice Live',
        async () => {
          closeConfirm();
          if (state.admin.busy) return;
          state.admin.busy = true;
          try {
            const count = await repriceAllPublishedOnGitHub();
            renderCatalog();
            showToast(`Repriced ${count} item${count === 1 ? '' : 's'} live on GitHub!`, 'success');
          } catch (err) {
            showToast(err?.message || 'Batch reprice failed.', 'error');
          } finally {
            state.admin.busy = false;
          }
        }
      );
    });

    $('btn-export-csv')?.addEventListener('click', () => {
      const all = [...state.admin.publishedItems, ...state.admin.localItems];
      if (!all.length) return showToast('No inventory items to export.', 'alert');
      const csv = catalogItemsToCsv(all);
      downloadTextFile(`sj-inventory-${todayIstIso()}.csv`, csv, 'text/csv;charset=utf-8');
      showToast(`Exported ${all.length} item(s) to CSV.`, 'success');
    });

    $('btn-export-json')?.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        gstin: SHOP_GSTIN,
        published: state.admin.publishedItems,
        orders: state.orders.items
      };
      downloadTextFile(`sj-admin-backup-${todayIstIso()}.json`, `${JSON.stringify(payload, null, 2)}\n`, 'application/json;charset=utf-8');
      showToast('Downloaded JSON backup (Inventory + Orders).', 'success');
    });

    $('btn-save-draft')?.addEventListener('click', async () => {
      if (state.admin.busy) return;
      const item = collectUploadForm();
      if (!item) return;
      state.admin.busy = true;
      try {
        item.media = state.admin.pendingFiles.map((f) => ({ type: f.type, mime: f.mime, name: f.file.name, blob: f.file }));
        await saveLocalDraft(item);
        state.admin.localItems.unshift(item);
        $('upload-form').reset();
        clearPendingFiles();
        renderCatalog();
        showToast('Saved as Local Draft (stored offline on this device).', 'success');
      } catch (err) {
        showToast(err?.message || 'Could not save draft.', 'error');
      } finally {
        state.admin.busy = false;
      }
    });

    $('upload-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.admin.busy) return;
      const item = collectUploadForm();
      if (!item) return;
      state.admin.busy = true;
      const blobs = state.admin.pendingFiles.map((f) => ({ type: f.type, mime: f.mime, name: f.file.name, blob: f.file }));
      try {
        await publishItemToGitHub(item, blobs);
        $('upload-form').reset();
        clearPendingFiles();
        renderCatalog();
        showToast(`Published "${item.name}" live to Satyanarayan Jewellers!`, 'success');
      } catch (err) {
        showToast(err?.message || 'Upload failed.', 'error');
      } finally {
        state.admin.busy = false;
        setTimeout(() => setUploadProgress(false), 1200);
      }
    });

    const publishAllDrafts = async () => {
      if (state.admin.busy || !state.admin.localItems.length) return;
      state.admin.busy = true;
      let count = 0;
      try {
        const snapshot = state.admin.localItems.slice();
        for (const draft of snapshot) {
          const blobs = (draft.media || [])
            .filter((m) => m && m.blob instanceof Blob)
            .map((m) => ({ type: m.type === 'video' ? 'video' : 'image', mime: m.mime || m.blob.type, name: m.name || '', blob: m.blob }));
          await publishItemToGitHub(draft, blobs);
          await deleteLocalDraft(draft.id);
          state.admin.localItems = state.admin.localItems.filter((x) => x.id !== draft.id);
          count += 1;
        }
        renderCatalog();
        showToast(`Published ${count} draft${count === 1 ? '' : 's'} to the live website!`, 'success');
      } catch (err) {
        showToast(err?.message || 'Stopped publishing drafts due to an error.', 'error');
      } finally {
        state.admin.busy = false;
        setTimeout(() => setUploadProgress(false), 1200);
      }
    };
    $('btn-publish-all-drafts')?.addEventListener('click', publishAllDrafts);
    $('btn-desk-publish-drafts')?.addEventListener('click', () => { switchView('catalog'); publishAllDrafts(); });
    $('btn-reload-catalog')?.addEventListener('click', () => refreshAllCatalog().then(() => showToast('Catalogue refreshed.', 'success')));

    // Catalogue filters & cards
    $('catalog-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat-filter]');
      if (!btn) return;
      state.admin.filter = btn.dataset.catFilter;
      document.querySelectorAll('[data-cat-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderCatalog();
    });
    $('catalog-search')?.addEventListener('input', (e) => { state.admin.search = e.target.value; renderCatalog(); });
    $('catalog-sort')?.addEventListener('change', (e) => { state.admin.sort = e.target.value; renderCatalog(); });

    $('catalog-grid')?.addEventListener('click', async (e) => {
      const lb = e.target.closest('[data-open-lb]');
      if (lb) return openLightbox(lb.dataset.openLb, lb.dataset.srcType);

      const edit = e.target.closest('[data-edit-item]');
      if (edit) return openEditModal(edit.dataset.editItem, edit.dataset.srcType);

      const tagBtn = e.target.closest('[data-tag-item]');
      if (tagBtn) return openTagModal(tagBtn.dataset.tagItem, tagBtn.dataset.srcType);

      const billBtn = e.target.closest('[data-bill-item]');
      if (billBtn) {
        const item = findItem(billBtn.dataset.billItem, billBtn.dataset.srcType);
        if (item) addCatalogItemToBill(item);
        return;
      }

      const wa = e.target.closest('[data-wa-item]');
      if (wa) {
        const item = findItem(wa.dataset.waItem, wa.dataset.srcType);
        if (!item) return;
        const msg = `Satyanarayan Jewellers, Cuttack\n${item.name}${item.purity ? ` (${item.purity})` : ''}${item.weight ? ` · ${item.weight}g` : ''}\n${item.price > 0 ? `Price: ${fmtINR(item.price)}` : 'Price on request'}${item.note ? `\n${item.note}` : ''}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        return;
      }

      const pub = e.target.closest('[data-pub-draft]');
      if (pub && !state.admin.busy) {
        const draft = findItem(pub.dataset.pubDraft, 'local');
        if (!draft) return;
        state.admin.busy = true;
        try {
          const blobs = (draft.media || [])
            .filter((m) => m && m.blob instanceof Blob)
            .map((m) => ({ type: m.type === 'video' ? 'video' : 'image', mime: m.mime || m.blob.type, name: m.name || '', blob: m.blob }));
          await publishItemToGitHub(draft, blobs);
          await deleteLocalDraft(draft.id);
          state.admin.localItems = state.admin.localItems.filter((x) => x.id !== draft.id);
          renderCatalog();
          showToast(`Published "${draft.name}" live!`, 'success');
        } catch (err) {
          showToast(err?.message || 'Publish failed.', 'error');
        } finally {
          state.admin.busy = false;
          setTimeout(() => setUploadProgress(false), 1200);
        }
        return;
      }

      const del = e.target.closest('[data-del-item]');
      if (del && !state.admin.busy) {
        const id = del.dataset.delItem;
        const src = del.dataset.srcType;
        const item = findItem(id, src);
        if (!item) return;
        openConfirm(
          src === 'local' ? 'Delete Local Draft?' : 'Remove Live Jewellery Item?',
          src === 'local'
            ? `Remove local draft "${item.name}" from this device?`
            : `Remove "${item.name}" from the live website catalogue and delete its media from GitHub?`,
          'Delete',
          async () => {
            closeConfirm();
            state.admin.busy = true;
            try {
              if (src === 'local') {
                await deleteLocalDraft(id);
                state.admin.localItems = state.admin.localItems.filter((x) => x.id !== id);
                showToast('Local draft removed.', 'success');
              } else {
                setUploadProgress(true, `Removing "${item.name}"…`, 50);
                await deletePublishedItemFromGitHub(item);
                setUploadProgress(true, 'Removed!', 100);
                showToast(`Removed "${item.name}" from live catalogue.`, 'success');
              }
              renderCatalog();
            } catch (err) {
              showToast(err?.message || 'Delete failed.', 'error');
            } finally {
              state.admin.busy = false;
              setTimeout(() => setUploadProgress(false), 1000);
            }
          }
        );
      }
    });

    // Edit Modal
    const closeEdit = () => $('edit-modal')?.classList.add('hidden');
    $('btn-close-edit')?.addEventListener('click', closeEdit);
    $('btn-cancel-edit')?.addEventListener('click', closeEdit);
    $('edit-modal')?.addEventListener('click', (e) => { if (e.target.id === 'edit-modal') closeEdit(); });
    $('btn-edit-autoprice')?.addEventListener('click', () => {
      if (!state.prices) return showToast('Waiting for live bullion rates…', 'alert');
      const w = Math.max(0, Number($('edit-weight')?.value) || 0);
      if (!(w > 0)) return showToast('Enter item weight (g) first.', 'alert');
      const est = computeAutoItemPrice({
        category: $('edit-category')?.value || 'Gold',
        purity: ($('edit-purity')?.value || '').trim(),
        weight: w,
        makingPct: Math.max(0, Number($('edit-making')?.value) || 0),
        includeGst: true
      });
      if (!est) return;
      $('edit-price').value = String(est.grandTotal);
      showToast(`Filled live ${est.metal} price: ${fmtINR(est.grandTotal)}`, 'success');
    });
    $('edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.admin.busy) return;
      const id = $('edit-id').value;
      const src = $('edit-source').value;
      const name = $('edit-name').value.trim();
      if (!name) return showToast('Name cannot be empty.', 'alert');
      const updated = {
        id,
        name,
        category: $('edit-category').value || 'Gold',
        purity: $('edit-purity').value.trim(),
        weight: Math.max(0, Number($('edit-weight').value) || 0),
        makingPct: Math.max(0, Number($('edit-making').value) || 0),
        price: Math.max(0, Number($('edit-price').value) || 0),
        sku: $('edit-sku').value.trim(),
        stockStatus: normalizeStockStatus($('edit-stock').value),
        featured: Boolean($('edit-featured').checked),
        note: $('edit-note').value.trim()
      };
      const btn = $('btn-save-edit');
      state.admin.busy = true;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        if (src === 'local') {
          const existing = findItem(id, 'local');
          if (!existing) throw new Error('Draft not found.');
          const merged = { ...existing, ...updated };
          await saveLocalDraft(merged);
          state.admin.localItems = state.admin.localItems.map((x) => (x.id === id ? merged : x));
          showToast('Local draft updated.', 'success');
        } else {
          await updatePublishedItemOnGitHub(updated);
          showToast(`Updated "${name}" live on GitHub!`, 'success');
        }
        closeEdit();
        renderCatalog();
      } catch (err) {
        showToast(err?.message || 'Could not save changes.', 'error');
      } finally {
        state.admin.busy = false;
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    });

    // Lightbox & Confirm modals
    const closeLb = () => {
      $('lightbox-modal')?.classList.add('hidden');
      if ($('lb-stage')) $('lb-stage').innerHTML = '';
      state.admin.lightboxItem = null;
      revokeLightboxObjectUrls();
    };
    $('btn-close-lb')?.addEventListener('click', closeLb);
    $('lightbox-modal')?.addEventListener('click', (e) => { if (e.target.id === 'lightbox-modal') closeLb(); });
    $('btn-lb-prev')?.addEventListener('click', () => {
      if (!state.admin.lightboxItem) return;
      const n = state.admin.lightboxItem.media.length;
      state.admin.lightboxIdx = (state.admin.lightboxIdx - 1 + n) % n;
      renderLightbox();
    });
    $('btn-lb-next')?.addEventListener('click', () => {
      if (!state.admin.lightboxItem) return;
      const n = state.admin.lightboxItem.media.length;
      state.admin.lightboxIdx = (state.admin.lightboxIdx + 1) % n;
      renderLightbox();
    });
    const closeTag = () => {
      $('tag-modal')?.classList.add('hidden');
      state.admin.tagItem = null;
    };
    $('btn-close-tag')?.addEventListener('click', closeTag);
    $('tag-modal')?.addEventListener('click', (e) => { if (e.target.id === 'tag-modal') closeTag(); });
    $('btn-tag-bill')?.addEventListener('click', () => {
      const it = state.admin.tagItem;
      closeTag();
      if (it) addCatalogItemToBill(it);
    });
    $('btn-tag-print')?.addEventListener('click', () => {
      if (!state.admin.tagItem) return;
      printHtmlInSlipSheet(`<div style="display:flex;justify-content:center;padding:1rem;">${buildTagCardHtml(state.admin.tagItem)}</div>`);
    });

    $('btn-confirm-cancel')?.addEventListener('click', closeConfirm);
    $('confirm-modal')?.addEventListener('click', (e) => { if (e.target.id === 'confirm-modal') closeConfirm(); });
    $('btn-confirm-ok')?.addEventListener('click', () => { if (typeof confirmCallback === 'function') confirmCallback(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeEdit(); closeLb(); closeConfirm(); closeTag(); }
    });

    // Exchanges
    $('ex-search')?.addEventListener('input', (e) => { state.exchanges.search = e.target.value; renderExchangeComparison(); });
    document.querySelectorAll('[data-ex-metal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.exchanges.metal = btn.dataset.exMetal;
        document.querySelectorAll('[data-ex-metal]').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderExchangeComparison();
      });
    });
    $('ex-sort')?.addEventListener('change', (e) => { state.exchanges.sortBy = e.target.value; renderExchangeComparison(); });
    $('btn-refresh-exchanges')?.addEventListener('click', () => { renderExchangeComparison(); showToast('Exchange table refreshed.', 'success'); });

    // Accuracy
    $('acc-metal')?.addEventListener('change', (e) => {
      state.accuracy.metal = e.target.value;
      state.accuracy.feeds = [];
      renderMarketAccuracy();
      fetchMarketAccuracy(false).then(renderMarketAccuracy);
    });
    $('btn-refresh-acc')?.addEventListener('click', () => fetchMarketAccuracy(true).then(renderMarketAccuracy));
    $('btn-calibrate')?.addEventListener('click', calibrateToConsensus);
    $('btn-reset-calib')?.addEventListener('click', () => {
      const m = state.accuracy.metal === 'silver' ? 'silver' : 'gold';
      if (m === 'gold') state.accuracy.calibPctGold = 0; else state.accuracy.calibPctSilver = 0;
      repriceAndRender(false);
      state.accuracy.shopBase = m === 'gold' ? state.prices.gold999ExGst : state.prices.silver999ExGst;
      state.accuracy.variancePct = state.accuracy.consensus ? ((state.accuracy.shopBase - state.accuracy.consensus) / state.accuracy.consensus) * 100 : 0;
      renderMarketAccuracy();
      showToast(`Reset ${m} calibration to 0.00%.`, 'info');
    });

    // Calculators
    ['calc-metal', 'calc-weight', 'calc-unit', 'calc-making', 'calc-making-type', 'calc-gst',
      'excalc-purity', 'excalc-weight', 'excalc-stone', 'excalc-newbill', 'excalc-hallmark']
      .forEach((id) => {
        $(id)?.addEventListener('input', updateCalculators);
        $(id)?.addEventListener('change', updateCalculators);
      });
    $('btn-excalc-gold')?.addEventListener('click', () => {
      state.exCalcMetal = 'gold';
      $('btn-excalc-gold').classList.add('is-active');
      $('btn-excalc-silver').classList.remove('is-active');
      $('excalc-purity').value = '91.6';
      $('excalc-hallmark').checked = true;
      updateCalculators();
    });
    $('btn-excalc-silver')?.addEventListener('click', () => {
      state.exCalcMetal = 'silver';
      $('btn-excalc-silver').classList.add('is-active');
      $('btn-excalc-gold').classList.remove('is-active');
      $('excalc-purity').value = '92.5';
      $('excalc-hallmark').checked = false;
      updateCalculators();
    });

    const buildQuoteText = () => {
      const q = computeQuoteMath({
        metal: $('calc-metal').value,
        weight: $('calc-weight').value,
        unit: $('calc-unit').value,
        makingVal: $('calc-making').value,
        makingType: $('calc-making-type').value,
        includeGst: Boolean($('calc-gst').checked)
      });
      if (!q) return '';
      const label = $('calc-metal').selectedOptions[0]?.textContent || $('calc-metal').value;
      return [
        'Satyanarayan Jewellers, Cuttack — Counter Estimate',
        `Item: ${label} · ${q.grams.toFixed(2)} g`,
        `Metal Value: ${fmtINR(q.baseValue)}`,
        `Making (${q.makingLabel}): ${fmtINR(q.makingCharges)}`,
        `GST (${q.gstAmount > 0 ? `${q.gstPct}%` : 'Excluded'}): ${fmtINR(q.gstAmount)}`,
        `Estimated Total: ${fmtINR(q.grandTotal)}`,
        `GSTIN: ${SHOP_GSTIN}`
      ].join('\n');
    };
    $('btn-copy-quote')?.addEventListener('click', async () => {
      const t = buildQuoteText();
      if (!t) return;
      try { await navigator.clipboard.writeText(t); showToast('Counter quote copied.', 'success'); } catch { /* ignore */ }
    });
    $('btn-wa-quote')?.addEventListener('click', () => {
      const t = buildQuoteText();
      if (!t) return;
      window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener,noreferrer');
    });

    // GST Estimate & Bill Slip Maker
    ['bill-doc-type', 'bill-number', 'bill-cust-name', 'bill-cust-phone',
      'bill-old-exchange', 'bill-discount', 'bill-advance', 'bill-notes', 'bill-include-gst']
      .forEach((id) => {
        $(id)?.addEventListener('input', renderBillSlip);
        $(id)?.addEventListener('change', renderBillSlip);
      });

    $('bill-pick-catalog')?.addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) return;
      const item = findItem(id, 'published') || findItem(id, 'local');
      e.target.value = '';
      if (!item) return;
      if ($('bill-item-desc')) $('bill-item-desc').value = item.name || '';
      if ($('bill-item-metal')) $('bill-item-metal').value = inferMetalCode(item.category, item.purity);
      if ($('bill-item-huid')) $('bill-item-huid').value = item.sku || '';
      if ($('bill-item-weight') && Number(item.weight) > 0) $('bill-item-weight').value = String(item.weight);
      if ($('bill-item-making')) $('bill-item-making').value = String(Number(item.makingPct) > 0 ? item.makingPct : 10);
      if ($('bill-item-making-type')) $('bill-item-making-type').value = 'pct';
      showToast(`Loaded "${item.name}" into item builder.`, 'info');
    });

    $('btn-bill-add-line')?.addEventListener('click', () => {
      const desc = ($('bill-item-desc')?.value || '').trim();
      const w = Math.max(0, Number($('bill-item-weight')?.value) || 0);
      const mt = $('bill-item-making-type')?.value || 'pct';
      if (!desc) return showToast('Enter an item description.', 'alert');
      if (!(w > 0) && mt !== 'flat') return showToast('Enter net weight in grams (or choose Flat ₹ making).', 'alert');
      state.bill.lines.push({
        id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        desc,
        metal: $('bill-item-metal')?.value || '22K',
        huid: ($('bill-item-huid')?.value || '').trim().toUpperCase(),
        weight: w,
        ratePerGram: Math.max(0, Number($('bill-item-rate')?.value) || 0),
        makingVal: Math.max(0, Number($('bill-item-making')?.value) || 0),
        makingType: mt
      });
      if ($('bill-item-desc')) $('bill-item-desc').value = '';
      if ($('bill-item-huid')) $('bill-item-huid').value = '';
      if ($('bill-item-rate')) $('bill-item-rate').value = '';
      renderBillSlip();
    });

    $('bill-lines-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del-bill-line]');
      if (!btn) return;
      state.bill.lines = state.bill.lines.filter((l) => l.id !== btn.dataset.delBillLine);
      renderBillSlip();
    });

    $('btn-bill-pull-ex')?.addEventListener('click', () => {
      const ex = computeOldExchangeMath({
        metal: state.exCalcMetal,
        purity: $('excalc-purity')?.value,
        weight: $('excalc-weight')?.value,
        stone: $('excalc-stone')?.value,
        hallmarked: Boolean($('excalc-hallmark')?.checked),
        newBill: 0
      });
      if (!ex || !(ex.netValue > 0)) return showToast('Calculate Old Gold/Silver value first in Counter Calculators.', 'alert');
      const credit = Math.round(ex.netValue);
      if ($('bill-old-exchange')) $('bill-old-exchange').value = String(credit);
      renderBillSlip();
      showToast(`Pulled old metal credit: ${fmtINR(credit)}`, 'success');
    });

    $('btn-bill-reset')?.addEventListener('click', () => {
      state.bill.lines = [];
      state.bill.billNo = nextBillNumber(true);
      if ($('bill-number')) $('bill-number').value = state.bill.billNo;
      if ($('bill-cust-name')) $('bill-cust-name').value = '';
      if ($('bill-cust-phone')) $('bill-cust-phone').value = '';
      if ($('bill-old-exchange')) $('bill-old-exchange').value = '0';
      if ($('bill-discount')) $('bill-discount').value = '0';
      if ($('bill-advance')) $('bill-advance').value = '0';
      if ($('bill-notes')) $('bill-notes').value = '';
      renderBillSlip();
      showToast(`Started fresh slip ${state.bill.billNo}.`, 'info');
    });

    $('btn-bill-print')?.addEventListener('click', () => {
      syncBillMetaFromInputs();
      const totals = computeBillTotals(state.bill);
      printHtmlInSlipSheet(`<div class="bill-preview-paper" style="max-width:44rem;margin:0 auto;">${renderBillSlipHtml(state.bill, totals)}</div>`);
    });

    $('btn-bill-wa')?.addEventListener('click', () => {
      syncBillMetaFromInputs();
      const text = buildBillShareText(state.bill);
      const rawDigits = (state.bill.customerPhone || '').replace(/\D/g, '');
      const waPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
      const base = waPhone.length >= 10 ? `https://wa.me/${waPhone}` : 'https://wa.me/';
      window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    });

    $('btn-bill-copy')?.addEventListener('click', async () => {
      syncBillMetaFromInputs();
      const text = buildBillShareText(state.bill);
      try {
        await navigator.clipboard.writeText(text);
        showToast('Bill slip summary copied to clipboard.', 'success');
      } catch {
        showToast('Clipboard unavailable on this browser.', 'alert');
      }
    });

    // Customer Orders & Advance Rate-Lock Book
    $('btn-ord-lock-live')?.addEventListener('click', () => {
      if (!state.prices) return showToast('Waiting for live bullion rates…', 'alert');
      const metal = $('ord-metal')?.value || '22K';
      const map = {
        '24K': state.prices.gold999ExGstGram,
        '22K': state.prices.gold916ExGstGram,
        '18K': state.prices.gold18ExGstGram,
        S999: state.prices.silver999ExGstGram,
        S925: state.prices.silver925ExGstGram
      };
      const rate = Math.round(map[metal] || state.prices.gold916ExGstGram || 0);
      if ($('ord-locked-rate')) $('ord-locked-rate').value = String(rate);
      showToast(`Locked ${metal} rate at ${fmtINR(rate)}/g.`, 'success');
    });

    $('order-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const rec = sanitizeOrderRecord({
        customerName: $('ord-name')?.value,
        phone: $('ord-phone')?.value,
        item: $('ord-item')?.value,
        metal: $('ord-metal')?.value,
        weight: $('ord-weight')?.value,
        lockedRate: $('ord-locked-rate')?.value,
        advance: $('ord-advance')?.value,
        dueDate: $('ord-due')?.value,
        status: $('ord-status')?.value,
        note: $('ord-note')?.value
      });
      if (!rec) return showToast('Enter customer name and jewellery item.', 'alert');
      state.orders.items.unshift(rec);
      persistOrderBook();
      $('order-form').reset();
      renderOrderBook();
      showToast(`Saved order for ${rec.customerName}.`, 'success');
    });

    $('ord-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ord-filter]');
      if (!btn) return;
      state.orders.filter = btn.dataset.ordFilter;
      document.querySelectorAll('[data-ord-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderOrderBook();
    });

    $('ord-list')?.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-ord-status]');
      if (!sel) return;
      const target = state.orders.items.find((o) => o.id === sel.dataset.ordStatus);
      if (!target) return;
      target.status = sel.value;
      persistOrderBook();
      renderOrderBook();
      showToast(`Order marked "${target.status}".`, 'success');
    });

    $('ord-list')?.addEventListener('click', (e) => {
      const waBtn = e.target.closest('[data-ord-wa]');
      if (waBtn) {
        const ord = state.orders.items.find((o) => o.id === waBtn.dataset.ordWa);
        if (!ord) return;
        const txt = buildOrderWhatsAppText(ord);
        const digits = (ord.phone || '').replace(/\D/g, '');
        const waPhone = digits.length === 10 ? `91${digits}` : digits;
        const base = waPhone.length >= 10 ? `https://wa.me/${waPhone}` : 'https://wa.me/';
        window.open(`${base}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener,noreferrer');
        return;
      }

      const billBtn = e.target.closest('[data-ord-to-bill]');
      if (billBtn) {
        const ord = state.orders.items.find((o) => o.id === billBtn.dataset.ordToBill);
        if (!ord) return;
        state.bill.customerName = ord.customerName;
        state.bill.customerPhone = ord.phone || '';
        state.bill.advance = Number(ord.advance) || 0;
        if ($('bill-cust-name')) $('bill-cust-name').value = ord.customerName;
        if ($('bill-cust-phone')) $('bill-cust-phone').value = ord.phone || '';
        if ($('bill-advance')) $('bill-advance').value = String(ord.advance || 0);
        state.bill.lines.push({
          id: `bl-${Date.now()}`,
          desc: ord.item,
          metal: ord.metal,
          huid: '',
          weight: Number(ord.weight) || 10,
          ratePerGram: Number(ord.lockedRate) || 0,
          makingVal: 10,
          makingType: 'pct'
        });
        switchSubtab('bill');
        showToast(`Loaded ${ord.customerName}'s order & advance into GST Bill Slip.`, 'success');
        return;
      }

      const delBtn = e.target.closest('[data-ord-del]');
      if (delBtn) {
        const ord = state.orders.items.find((o) => o.id === delBtn.dataset.ordDel);
        if (!ord) return;
        openConfirm('Delete Order Entry?', `Remove order "${ord.item}" for ${ord.customerName} from this device?`, 'Delete', () => {
          closeConfirm();
          state.orders.items = state.orders.items.filter((o) => o.id !== ord.id);
          persistOrderBook();
          renderOrderBook();
          showToast('Order removed.', 'info');
        });
      }
    });

    $('btn-ord-export')?.addEventListener('click', () => {
      if (!state.orders.items.length) return showToast('No orders recorded yet.', 'alert');
      downloadTextFile(`sj-customer-orders-${todayIstIso()}.json`, `${JSON.stringify(state.orders.items, null, 2)}\n`, 'application/json;charset=utf-8');
      showToast('Exported customer orders JSON.', 'success');
    });

    // Statutory Publisher
    ['st-gold-duty', 'st-gold-gst', 'st-gold-eff', 'st-gold-ver', 'st-gold-note',
      'st-silver-duty', 'st-silver-gst', 'st-silver-eff', 'st-silver-ver', 'st-silver-note']
      .forEach((id) => $(id)?.addEventListener('input', renderStatutoryPreview));
    $('btn-reload-statutory')?.addEventListener('click', () => loadStatutoryRates(true).then(() => showToast('Reloaded catalog/statutory-rates.json.', 'success')));
    $('btn-st-mark-today')?.addEventListener('click', () => {
      const today = todayIstIso();
      if ($('st-gold-ver')) $('st-gold-ver').value = today;
      if ($('st-silver-ver')) $('st-silver-ver').value = today;
      renderStatutoryPreview();
      showToast(`Stamped verified date to ${today}. Click Publish to save.`, 'info');
    });
    $('statutory-form')?.addEventListener('submit', (e) => { e.preventDefault(); publishStatutoryRatesToGitHub(); });

    // PWA Install, SW Update & Cache Controls
    ['btn-install-header', 'btn-install-settings', 'btn-install-auth'].forEach((id) => {
      $(id)?.addEventListener('click', triggerPwaInstall);
    });
    $('btn-sw-reload')?.addEventListener('click', () => {
      if (state.pwa.waitingWorker) state.pwa.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      else window.location.reload();
    });
    $('btn-check-sw-update')?.addEventListener('click', async () => {
      if (!state.pwa.swReg) return showToast('Service worker is not active in this environment.', 'info');
      await state.pwa.swReg.update().catch(() => {});
      showToast('Checked for Admin PWA updates.', 'success');
    });
    $('btn-sec-clear-cache')?.addEventListener('click', () => {
      lsRemove(STORAGE_KEYS.lastRates);
      lsRemove(STORAGE_KEYS.statutoryRates);
      showToast('Local rate cache cleared. Syncing fresh rates…', 'success');
      loadStatutoryRates(true);
      syncMetalsRest(true);
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.pwa.deferredPrompt = e;
      updateInstallUI();
    });
    window.addEventListener('appinstalled', () => {
      state.pwa.deferredPrompt = null;
      updateInstallUI();
      showToast('SJ Admin Desk installed!', 'success');
    });
    window.addEventListener('online', () => {
      renderLiveStatusBadge();
      updateDiagnostics();
      if (state.admin.unlocked) {
        if (state.admin.offlineSession && state.admin.token) {
          verifyGitHubToken(state.admin.token).then((v) => {
            state.admin.offlineSession = false;
            saveVerifiedMeta(v.token, v.login);
            unlockWorkspace({ token: v.token, login: v.login, offline: false });
            showToast('Back online · GitHub admin session verified.', 'success');
          }).catch((err) => {
            if (err && err.authError) {
              lockWorkspace(true);
              showToast(err.message || 'Admin token revoked or invalid. Please sign in again.', 'error');
            }
          });
        }
        connectLiveWebSockets();
        syncMetalsRest(false);
      }
    });
    window.addEventListener('offline', () => {
      renderLiveStatusBadge();
      updateDiagnostics();
    });
    window.addEventListener('hashchange', () => {
      if (!state.admin.unlocked) return;
      const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
      if (['desk', 'catalog', 'exchanges', 'accuracy', 'settings'].includes(hash)) {
        switchView(hash);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimeout(state.live.fxTimer);
      } else if (state.admin.unlocked) {
        scheduleFxHeartbeat();
        syncMetalsRest(false);
      }
    });
  }

  // Expose pure helpers for automated unit tests without affecting browser behavior.
  if (typeof globalThis !== 'undefined') {
    globalThis.__ADMIN_PWA_API__ = {
      ADMIN_APP_VERSION,
      computeCityPrices,
      computeExchangeRows,
      computeQuoteMath,
      computeOldExchangeMath,
      buildRatesShareText,
      sanitizeCatalogMediaUrl,
      toAdminMediaSrc,
      sanitizeStatutoryPayload,
      validateStatutoryDraft,
      statutoryRatesFor,
      statutoryIsStale,
      verifyGitHubToken,
      acceptSpot,
      validateUsdInr,
      tokenFingerprint,
      todayIstIso,
      refreshLiveFx,
      inferMetalCode,
      normalizeStockStatus,
      stockStatusLabel,
      computeAutoItemPrice,
      computeBillTotals,
      buildBillShareText,
      sanitizeOrderRecord,
      buildOrderWhatsAppText,
      catalogItemsToCsv,
      generateQrSvg,
      state
    };
  }

  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-admin-version]').forEach((el) => {
      el.textContent = ADMIN_APP_VERSION;
    });
    bindEvents();
    registerAdminServiceWorker();
    updateInstallUI();
    tryAutoRestoreSession();
  }
})();
