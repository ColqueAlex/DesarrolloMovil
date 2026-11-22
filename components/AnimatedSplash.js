import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

const BACKGROUND = '#F2F6F4';
const CORAL = '#EE684D';

// Dimensiones reales de assets/logo.png (720 x 346 px).
const LOGO_W = 720;
const LOGO_H = 346;

// Medidas en píxeles del PNG:
// - "EL REFUGIO": desde el borde izquierdo de la "E" (x 239) hasta el borde
//   derecho de la "O" (x 668). Las letras terminan en y 251.
// - Línea coral estática: x 239–337, y 268–276 (la pista la cubre entera).
const TEXT_LEFT = 239;
const TEXT_RIGHT = 668;
const TRACK = { x: TEXT_LEFT, y: 265, w: TEXT_RIGHT - TEXT_LEFT, h: 15 };

const FILL_DURATION = 1300;
const HOLD_DURATION = 250;

export default function AnimatedSplash() {
  const { width: screenW } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  const logoWidth = Math.min(screenW * 0.85, 380);
  const scale = logoWidth / LOGO_W;
  const logoHeight = LOGO_H * scale;

  const trackLeft = TRACK.x * scale;
  const trackTop = TRACK.y * scale;
  const trackWidth = TRACK.w * scale;
  const trackHeight = TRACK.h * scale;
  const barHeight = Math.max(trackHeight * 0.6, 4);

  useEffect(() => {
    // barFill: se llena de 0% a 100% del ancho de la pista, se mantiene un
    // instante completo y vuelve a empezar.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: FILL_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_DURATION),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  // La barra mide lo mismo que la pista y entra desde la izquierda:
  // con progress = 1 cubre el 100% hasta el final de "REFUGIO".
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-trackWidth, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />
      <View style={{ width: logoWidth, height: logoHeight }}>
        <Image
          source={require('../assets/logo.png')}
          style={{ width: logoWidth, height: logoHeight }}
          resizeMode="contain"
          accessibilityLabel="Almacén El Refugio"
        />
        <View
          style={[
            styles.barTrack,
            {
              left: trackLeft,
              top: trackTop,
              width: trackWidth,
              height: trackHeight,
              borderRadius: trackHeight / 2,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.barFill,
              {
                width: trackWidth,
                height: barHeight,
                borderRadius: barHeight / 2,
                transform: [{ translateX }],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barTrack: {
    position: 'absolute',
    backgroundColor: BACKGROUND,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    backgroundColor: CORAL,
  },
});
