import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  bg:          '#080D0F',
  bgPanel:     '#0C1418',
  bgCard:      '#101820',
  bgInput:     '#0A1218',
  border:      '#1A2830',
  borderHi:    '#1E3040',
  green:       '#00E5A0',
  greenDim:    '#00A070',
  greenGlow:   'rgba(0,229,160,0.15)',
  amber:       '#FFB300',
  amberDim:    '#CC8800',
  amberGlow:   'rgba(255,179,0,0.15)',
  red:         '#FF4444',
  redDim:      '#CC2222',
  redGlow:     'rgba(255,68,68,0.15)',
  cyan:        '#00C8E0',
  cyanDim:     '#009AB0',
  white:       '#E8F0F4',
  dim:         '#4A6070',
  dimmer:      '#2A3840',
  scanline:    'rgba(0,229,160,0.03)',
};

const XWIND_LIMIT_KT  = 15;
const KT_TO_KMH       = 1.852;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toRad(deg) { return (deg * Math.PI) / 180; }

function reciprocalRwy(rwyNum) {
  const recip = rwyNum > 18 ? rwyNum - 18 : rwyNum + 18;
  return recip;
}

function calcComponents(rwyNum, windDir, windSpd) {
  const rwyHdg    = ((parseInt(rwyNum, 10) || 0) * 10) % 360;
  const delta     = toRad(windDir - rwyHdg);
  const headwind  = windSpd * Math.cos(delta);
  const crosswind = windSpd * Math.sin(delta);

  // Reciprocal runway
  const recipNum  = reciprocalRwy(parseInt(rwyNum, 10));
  const recipHdg  = (recipNum * 10) % 360;
  const deltaR    = toRad(windDir - recipHdg);
  const headwindR = windSpd * Math.cos(deltaR);
  const crosswindR = windSpd * Math.sin(deltaR);

  // Best runway = higher headwind component (or less negative if both tailwind)
  const bestIsRecip = headwindR > headwind;

  return {
    rwyHdg,
    headwind:  parseFloat(headwind.toFixed(1)),
    crosswind: parseFloat(Math.abs(crosswind).toFixed(1)),
    crossDir:  crosswind < 0 ? 'LEFT' : 'RIGHT',
    origRwyNum: parseInt(rwyNum, 10).toString().padStart(2, '0'),
    recipNum:  recipNum.toString().padStart(2, '0'),
    recipHdg,
    recipHeadwind:  parseFloat(headwindR.toFixed(1)),
    recipCrosswind: parseFloat(Math.abs(crosswindR).toFixed(1)),
    recipCrossDir:  crosswindR < 0 ? 'LEFT' : 'RIGHT',
    bestIsRecip,
    bestRwyNum: bestIsRecip ? recipNum.toString().padStart(2, '0') : parseInt(rwyNum, 10).toString().padStart(2, '0'),
    bestHeadwind: parseFloat((bestIsRecip ? headwindR : headwind).toFixed(1)),
    bestCrosswind: parseFloat((bestIsRecip ? Math.abs(crosswindR) : Math.abs(crosswind)).toFixed(1)),
  };
}

function fmtKt(v, unit) {
  if (unit === 'kmh') return (Math.abs(v) * KT_TO_KMH).toFixed(1);
  return Math.abs(v).toFixed(1);
}

function unitLabel(unit) { return unit === 'kmh' ? 'KM/H' : 'KT'; }

// ─── Compass ──────────────────────────────────────────────────────────────────
function CompassRose({ rwyHdg, windDir, size = 160 }) {
  const cx    = size / 2;
  const r     = size / 2 - 14;
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);

  function polarPt(deg, radius, offsetX = 0, offsetY = 0) {
    const rad = toRad(deg - 90);
    return { x: cx + radius * Math.cos(rad) + offsetX, y: cx + radius * Math.sin(rad) + offsetY };
  }

  const rwyIn   = polarPt(rwyHdg, r - 20);
  const rwyOut  = polarPt(rwyHdg, r - 2);
  const rwyIn2  = polarPt((rwyHdg + 180) % 360, r - 20);
  const rwyOut2 = polarPt((rwyHdg + 180) % 360, r - 2);

  const wndPt   = polarPt(windDir, r - 8);
  const wndOrig = { x: cx, y: cx };

  return (
    <View style={[compassStyles.wrap, { width: size, height: size }]}>
      {/* SVG-like circles via absolute views */}
      <View style={[compassStyles.ring, { width: size, height: size, borderRadius: size / 2 }]} />
      <View style={[compassStyles.ringInner, { width: size - 28, height: size - 28, borderRadius: (size - 28) / 2, left: 14, top: 14 }]} />

      {/* Cardinal labels */}
      {[['N',0],['E',90],['S',180],['W',270]].map(([lbl, deg]) => {
        const pt = polarPt(deg, r - 8);
        return (
          <Text key={lbl} style={[compassStyles.cardinal, { left: pt.x - 6, top: pt.y - 7 }]}>
            {lbl}
          </Text>
        );
      })}

      {/* Tick marks as tiny dots */}
      {ticks.map(deg => {
        const inner = polarPt(deg, r - 20);
        const outer = polarPt(deg, r - 14);
        const isMajor = deg % 90 === 0;
        return (
          <View
            key={deg}
            style={[
              compassStyles.tick,
              {
                left: outer.x - (isMajor ? 2 : 1),
                top: outer.y - (isMajor ? 2 : 1),
                width: isMajor ? 4 : 2,
                height: isMajor ? 4 : 2,
                borderRadius: 2,
                backgroundColor: isMajor ? COLORS.green : COLORS.dimmer,
              },
            ]}
          />
        );
      })}

      {/* Runway line */}
      <View
        style={[
          compassStyles.line,
          {
            left: Math.min(rwyIn.x, rwyIn2.x),
            top: Math.min(rwyIn.y, rwyIn2.y),
            width: Math.sqrt(Math.pow(rwyOut.x - rwyIn.x, 2) + Math.pow(rwyOut.y - rwyIn.y, 2)),
            transform: [{ rotate: `${rwyHdg}deg` }],
            backgroundColor: COLORS.cyan,
            transformOrigin: 'left center',
          },
        ]}
      />
      {/* Full runway line (simpler: just draw a rotated bar through center) */}
      <View
        style={{
          position: 'absolute',
          width: 4,
          height: r * 1.6,
          backgroundColor: COLORS.cyan,
          left: cx - 2,
          top: cx - r * 0.8,
          transform: [{ rotate: `${rwyHdg}deg` }],
          opacity: 0.7,
          borderRadius: 2,
        }}
      />

      {/* Wind arrow */}
      <View
        style={{
          position: 'absolute',
          width: 2,
          height: r * 0.8,
          backgroundColor: COLORS.amber,
          left: cx - 1,
          top: cx - r * 0.8,
          transform: [{ rotate: `${windDir}deg` }],
          borderRadius: 1,
          opacity: 0.9,
        }}
      />
      {/* Wind arrowhead */}
      <View
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          left: cx - 5,
          top: cx - r * 0.8 - 8,
          borderLeftWidth: 5,
          borderRightWidth: 5,
          borderBottomWidth: 10,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: COLORS.amber,
          transform: [{ rotate: `${windDir}deg` }, { translateX: 0 }],
        }}
      />

      {/* Center dot */}
      <View style={compassStyles.center} />

      {/* Labels */}
      <Text style={[compassStyles.rwyLabel, { left: 2, top: cx - 7 }]}>RWY</Text>
      <Text style={[compassStyles.wndLabel, { left: size - 28, top: cx - 7 }]}>WND</Text>
    </View>
  );
}

const compassStyles = StyleSheet.create({
  wrap:      { position: 'relative', alignSelf: 'center' },
  ring:      { position: 'absolute', borderWidth: 1, borderColor: COLORS.green, opacity: 0.4 },
  ringInner: { position: 'absolute', borderWidth: 1, borderColor: COLORS.borderHi, opacity: 0.5 },
  cardinal:  { position: 'absolute', color: COLORS.greenDim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700' },
  tick:      { position: 'absolute' },
  line:      { position: 'absolute', height: 2 },
  center:    { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green, left: '50%', top: '50%', marginLeft: -4, marginTop: -4 },
  rwyLabel:  { position: 'absolute', color: COLORS.cyanDim, fontSize: 7, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1 },
  wndLabel:  { position: 'absolute', color: COLORS.amberDim, fontSize: 7, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1 },
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ text }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelLine} />
      <Text style={styles.sectionLabel}>{text}</Text>
      <View style={styles.sectionLabelLine} />
    </View>
  );
}

function InputField({ label, value, onChangeText, placeholder, maxLength = 3, keyboardType = 'numeric' }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.dimmer}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={COLORS.green}
      />
    </View>
  );
}

function ResultCard({ label, value, unit, sublabel, color, glow, warn }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (warn) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [warn]);

  return (
    <View style={[styles.resultCard, { borderColor: color, backgroundColor: glow }]}>
      <Text style={styles.resultLabel}>{label}</Text>
      <View style={styles.resultValueRow}>
        <Text style={[styles.resultValue, { color }]}>{value}</Text>
        <Text style={[styles.resultUnit, { color }]}>{unit}</Text>
      </View>
      {sublabel ? (
        <View style={styles.resultSubRow}>
          <Animated.View style={[styles.subDot, { backgroundColor: color, opacity: pulse }]} />
          <Text style={[styles.resultSub, { color }]}>{sublabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function WarningBanner({ text }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.warnBanner, { opacity: blink }]}>
      <Text style={styles.warnBannerText}>⚠  {text}</Text>
    </Animated.View>
  );
}

function UnitToggle({ unit, onChange }) {
  return (
    <View style={styles.unitToggleWrap}>
      {['kt', 'kmh'].map(u => (
        <TouchableOpacity key={u} onPress={() => onChange(u)} style={[styles.unitBtn, unit === u && styles.unitBtnActive]}>
          <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
            {u === 'kt' ? 'KNOTS' : 'KM/H'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Best Runway Panel ────────────────────────────────────────────────────────
function BestRunwayPanel({ result, unit }) {
  const ul = unitLabel(unit);

  function RwyColumn({ rwyNum, headwind, crosswind, isBest }) {
    const isTailwind = headwind < 0;
    const hwColor    = isTailwind ? COLORS.red : COLORS.green;
    return (
      <View style={[bestStyles.rwyCol, isBest && bestStyles.rwyColBest]}>
        {isBest && (
          <View style={bestStyles.bestBadge}>
            <Text style={bestStyles.bestBadgeText}>BEST</Text>
          </View>
        )}
        <Text style={[bestStyles.rwyNum, isBest && { color: COLORS.green }]}>
          RWY {rwyNum}
        </Text>
        <Text style={bestStyles.hdgText}>
          {(parseInt(rwyNum, 10) * 10).toString().padStart(3, '0')}°
        </Text>
        <View style={bestStyles.colDivider} />
        <Text style={bestStyles.compLabel}>{isTailwind ? 'TWC' : 'HWC'}</Text>
        <Text style={[bestStyles.compValue, { color: hwColor }]}>
          {fmtKt(headwind, unit)}{' '}
          <Text style={bestStyles.compUnit}>{ul}</Text>
        </Text>
        <Text style={bestStyles.compLabel}>XWIND</Text>
        <Text style={[bestStyles.compValue, { color: COLORS.amber }]}>
          {fmtKt(crosswind, unit)}{' '}
          <Text style={bestStyles.compUnit}>{ul}</Text>
        </Text>
        {isTailwind && <Text style={bestStyles.tailwindTag}>TWC</Text>}
      </View>
    );
  }

  return (
    <View style={bestStyles.panel}>
      <SectionLabel text="BEST RUNWAY RECOMMENDATION" />
      <View style={bestStyles.columns}>
        <RwyColumn
          rwyNum={result.origRwyNum}
          headwind={result.headwind}
          crosswind={result.crosswind}
          isBest={!result.bestIsRecip}
        />
        <View style={bestStyles.vs}>
          <View style={bestStyles.vsLine} />
          <Text style={bestStyles.vsText}>VS</Text>
          <View style={bestStyles.vsLine} />
        </View>
        <RwyColumn
          rwyNum={result.recipNum}
          headwind={result.recipHeadwind}
          crosswind={result.recipCrosswind}
          isBest={result.bestIsRecip}
        />
      </View>
      <View style={bestStyles.verdict}>
        <Text style={bestStyles.verdictLabel}>RECOMMENDATION</Text>
        <Text style={bestStyles.verdictValue}>USE RWY {result.bestRwyNum}</Text>
        <Text style={bestStyles.verdictSub}>
          {result.bestHeadwind >= 0
            ? `${fmtKt(result.bestHeadwind, unit)} ${ul} HWC  ·  ${fmtKt(result.bestCrosswind, unit)} ${ul} XWIND`
            : `LEAST UNFAVOURABLE — ${fmtKt(Math.abs(result.bestHeadwind), unit)} ${ul} TAILWIND`}
        </Text>
      </View>
    </View>
  );
}

const bestStyles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  columns:    { flexDirection: 'row', alignItems: 'flex-start' },
  rwyCol: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: COLORS.bgInput,
    minHeight: 130,
  },
  rwyColBest: {
    borderColor: COLORS.green,
    backgroundColor: 'rgba(0,229,160,0.06)',
  },
  bestBadge: {
    backgroundColor: COLORS.green,
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  bestBadgeText: {
    color: COLORS.bg,
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  rwyNum: {
    color: COLORS.dim,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '700',
    letterSpacing: 2,
  },
  hdgText: {
    color: COLORS.dimmer,
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 1,
    marginBottom: 6,
  },
  colDivider:  { height: 1, backgroundColor: COLORS.border, marginBottom: 6 },
  compLabel:   { color: COLORS.dim, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 1 },
  compValue:   { fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  compUnit:    { fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '400' },
  tailwindTag: { color: COLORS.red, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  vs: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  vsLine: { flex: 1, width: 1, backgroundColor: COLORS.border },
  vsText: { color: COLORS.dimmer, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 1, paddingVertical: 4 },
  verdict: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderHi,
    alignItems: 'center',
  },
  verdictLabel: { color: COLORS.dim, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2, marginBottom: 4 },
  verdictValue: { color: COLORS.green, fontSize: 22, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 4 },
  verdictSub:   { color: COLORS.greenDim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 1, marginTop: 3, textAlign: 'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RunwayWindCalculator() {
  const [runway,   setRunway]   = useState('');
  const [windDir,  setWindDir]  = useState('');
  const [windSpd,  setWindSpd]  = useState('');
  const [unit,     setUnit]     = useState('kt');
  const [result,   setResult]   = useState(null);
  const [errors,   setErrors]   = useState({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Live calculation
  useEffect(() => {
    const rwyNum = parseInt(runway, 10);
    const wDir   = parseFloat(windDir);
    const wSpd   = parseFloat(windSpd);

    const newErrors = {};
    if (runway  && (isNaN(rwyNum) || rwyNum < 1 || rwyNum > 36)) newErrors.runway  = 'RWY 01–36';
    if (windDir && (isNaN(wDir)   || wDir < 0   || wDir > 360))  newErrors.windDir = '0–360°';
    if (windSpd && (isNaN(wSpd)   || wSpd < 0   || wSpd > 250))  newErrors.windSpd = '0–250';
    setErrors(newErrors);

    if (runway && windDir && windSpd && !Object.keys(newErrors).length &&
        !isNaN(rwyNum) && !isNaN(wDir) && !isNaN(wSpd)) {
      const r = calcComponents(rwyNum, wDir, wSpd);
      setResult(r);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      setResult(null);
      fadeAnim.setValue(0);
    }
  }, [runway, windDir, windSpd]);

  const hasTailwind = result && result.headwind < 0;
  const hasXwindWarn = result && result.crosswind > XWIND_LIMIT_KT;
  const ul = unitLabel(unit);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>LIVE</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>WIND COMP</Text>
          <Text style={styles.titleSub}>RUNWAY ANALYSIS SYSTEM</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerTag}>v2.4</Text>
          <Text style={styles.headerTag}>ATC</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Unit Toggle */}
        <UnitToggle unit={unit} onChange={setUnit} />

        {/* Inputs */}
        <View style={styles.panel}>
          <SectionLabel text="INPUT PARAMETERS" />
          <View style={styles.inputRow}>
            <InputField
              label="RWY"
              value={runway}
              onChangeText={setRunway}
              placeholder="09"
              maxLength={2}
            />
            <InputField
              label="WND DIR"
              value={windDir}
              onChangeText={setWindDir}
              placeholder="270°"
              maxLength={3}
            />
            <InputField
              label={`WND SPD (${ul})`}
              value={windSpd}
              onChangeText={setWindSpd}
              placeholder="15"
              maxLength={3}
            />
          </View>

          {/* Errors */}
          {Object.entries(errors).map(([k, msg]) => (
            <Text key={k} style={styles.errorText}>⚑  {k.toUpperCase()}: {msg}</Text>
          ))}

          {/* Computed heading */}
          {result && (
            <View style={styles.hdgRow}>
              <Text style={styles.hdgLabel}>RWY HDG</Text>
              <Text style={styles.hdgValue}>{result.rwyHdg.toString().padStart(3,'0')}°</Text>
              <View style={styles.hdgSep} />
              <Text style={styles.hdgLabel}>WND</Text>
              <Text style={styles.hdgValue}>{parseFloat(windDir).toString().padStart(3,'0')}° / {fmtKt(parseFloat(windSpd), unit)} {ul}</Text>
            </View>
          )}
        </View>

        {/* Compass Visualization */}
        {result && (
          <Animated.View style={[styles.panel, styles.compassPanel, { opacity: fadeAnim }]}>
            <SectionLabel text="WIND / RUNWAY BEARING" />
            <CompassRose
              rwyHdg={result.rwyHdg}
              windDir={parseFloat(windDir)}
              size={Math.min(width - 60, 200)}
            />
            <View style={styles.compassLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.cyan }]} />
                <Text style={styles.legendText}>RUNWAY AXIS</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.amber }]} />
                <Text style={styles.legendText}>WIND VECTOR</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Best Runway Recommendation */}
        {result && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <BestRunwayPanel result={result} unit={unit} />
          </Animated.View>
        )}

        {/* Results */}
        {result && (
          <Animated.View style={[styles.panel, { opacity: fadeAnim }]}>
            <SectionLabel text="WIND COMPONENTS" />
            <View style={styles.resultsGrid}>

              {/* Headwind / Tailwind */}
              <ResultCard
                label={hasTailwind ? 'TWC' : 'HWC'}
                value={fmtKt(result.headwind, unit)}
                unit={ul}
                sublabel={hasTailwind ? 'TAILWIND' : 'HEADWIND'}
                color={hasTailwind ? COLORS.red : COLORS.green}
                glow={hasTailwind ? COLORS.redGlow : COLORS.greenGlow}
                warn={hasTailwind}
              />

              {/* Crosswind */}
              <ResultCard
                label="XWIND"
                value={fmtKt(result.crosswind, unit)}
                unit={ul}
                sublabel={`${result.crossDir}`}
                color={COLORS.amber}
                glow={COLORS.amberGlow}
                warn={hasXwindWarn}
              />
            </View>

            {/* Component bar viz */}
            <View style={styles.barSection}>
              <ComponentBar
                headwindPct={Math.min(Math.abs(result.headwind) / Math.max(parseFloat(windSpd), 1), 1)}
                crosswindPct={Math.min(result.crosswind / Math.max(parseFloat(windSpd), 1), 1)}
                hasTailwind={hasTailwind}
                speedKt={parseFloat(windSpd)}
                unit={unit}
              />
            </View>
          </Animated.View>
        )}

        {/* Warnings */}
        {result && (hasTailwind || hasXwindWarn) && (
          <View style={styles.warningsPanel}>
            <SectionLabel text="ALERTS" />
            {hasTailwind && (
              <WarningBanner text={`TAILWIND COMPONENT: ${fmtKt(Math.abs(result.headwind), unit)} ${ul} — VERIFY RWY IN USE`} />
            )}
            {hasXwindWarn && (
              <WarningBanner text={`CROSSWIND EXCEEDS ${XWIND_LIMIT_KT} KT LIMIT — VERIFY AIRCRAFT LIMITS`} />
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>RWY WIND COMPONENT CALCULATOR  ·  FOR REFERENCE ONLY</Text>
          <Text style={styles.footerText}>ALWAYS VERIFY WITH OFFICIAL ATIS/METAR</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Component Bar ────────────────────────────────────────────────────────────
function ComponentBar({ headwindPct, crosswindPct, hasTailwind, speedKt, unit }) {
  const hColor = hasTailwind ? COLORS.red : COLORS.green;
  const ul = unitLabel(unit);
  return (
    <View style={barStyles.wrap}>
      <View style={barStyles.row}>
        <Text style={barStyles.label}>{hasTailwind ? 'TWC' : 'HWC'}</Text>
        <View style={barStyles.track}>
          <View style={[barStyles.fill, { width: `${headwindPct * 100}%`, backgroundColor: hColor }]} />
        </View>
        <Text style={[barStyles.pct, { color: hColor }]}>{Math.round(headwindPct * 100)}%</Text>
      </View>
      <View style={barStyles.row}>
        <Text style={barStyles.label}>XWIND</Text>
        <View style={barStyles.track}>
          <View style={[barStyles.fill, { width: `${crosswindPct * 100}%`, backgroundColor: COLORS.amber }]} />
          {/* Limit marker at 15kt */}
          {speedKt > 0 && (
            <View style={[barStyles.limitMark, { left: `${Math.min((XWIND_LIMIT_KT / speedKt) * 100, 100)}%` }]} />
          )}
        </View>
        <Text style={[barStyles.pct, { color: COLORS.amber }]}>{Math.round(crosswindPct * 100)}%</Text>
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrap:      { marginTop: 10 },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label:     { width: 46, color: COLORS.dim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 1 },
  track:     { flex: 1, height: 6, backgroundColor: COLORS.dimmer, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  fill:      { height: '100%', borderRadius: 3 },
  limitMark: { position: 'absolute', top: -2, width: 2, height: 10, backgroundColor: COLORS.red, borderRadius: 1 },
  pct:       { width: 36, textAlign: 'right', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgPanel,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', width: 50 },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerRight: { width: 50, alignItems: 'flex-end' },
  statusDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green, marginRight: 5 },
  statusText:  { color: COLORS.greenDim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2 },
  title:       { color: COLORS.white, fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 4 },
  titleSub:    { color: COLORS.dim, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2, marginTop: 1 },
  headerTag:   { color: COLORS.dimmer, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 1, lineHeight: 12 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 40 },

  // Unit toggle
  unitToggleWrap: { flexDirection: 'row', alignSelf: 'flex-end', marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  unitBtn:        { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.bgCard },
  unitBtnActive:  { backgroundColor: COLORS.green },
  unitBtnText:    { color: COLORS.dim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1 },
  unitBtnTextActive: { color: COLORS.bg },

  // Panel
  panel: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  compassPanel: { alignItems: 'center' },

  // Section label
  sectionLabelRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionLabel:     { color: COLORS.dim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2, marginHorizontal: 8 },
  sectionLabelLine: { flex: 1, height: 1, backgroundColor: COLORS.border },

  // Inputs
  inputRow:   { flexDirection: 'row', gap: 8 },
  inputGroup: { flex: 1 },
  inputLabel: { color: COLORS.green, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    color: COLORS.white,
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 10,
    textAlign: 'center',
    letterSpacing: 2,
  },
  inputFocused: { borderColor: COLORS.green },
  errorText:    { color: COLORS.red, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', marginTop: 6, letterSpacing: 1 },

  // HDG row
  hdgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
    gap: 6,
  },
  hdgLabel: { color: COLORS.dim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2 },
  hdgValue: { color: COLORS.cyan, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 2, marginLeft: 4 },
  hdgSep:   { width: 1, height: 12, backgroundColor: COLORS.border, marginHorizontal: 8 },

  // Compass legend
  compassLegend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendText:    { color: COLORS.dim, fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 1 },

  // Results grid
  resultsGrid: { flexDirection: 'row', gap: 10 },
  resultCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 5,
    padding: 12,
  },
  resultLabel:    { color: COLORS.dim, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 2, marginBottom: 4 },
  resultValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  resultValue:    { fontSize: 28, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1 },
  resultUnit:     { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  resultSubRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  resultSub:      { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontWeight: '700', letterSpacing: 1.5 },
  subDot:         { width: 6, height: 6, borderRadius: 3 },
  barSection:     { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },

  // Warnings
  warningsPanel: {
    backgroundColor: '#120808',
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  warnBanner: {
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
    backgroundColor: COLORS.redGlow,
  },
  warnBannerText: {
    color: COLORS.red,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Footer
  footer: { alignItems: 'center', marginTop: 10, gap: 2 },
  footerText: {
    color: COLORS.dimmer,
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 1,
    textAlign: 'center',
  },
});