import { Billboard, Text } from '@react-three/drei';

export interface CityBlockLabel {
  id: string;
  text: string;
  x: number;
  z: number;
  /** Half-depth of the district strip (world units); used to place the label along the strip edge. */
  halfD: number;
}

interface CityBlockLabelsProps {
  labels: CityBlockLabel[];
}

/**
 * Vertical (industry) district names — billboarded so they stay readable from orbit.
 */
export function CityBlockLabels({ labels }: CityBlockLabelsProps) {
  if (labels.length === 0) return null;
  return (
    <group>
      {labels.map((lb) => {
        const hd = lb.halfD > 0 ? lb.halfD : 4;
        const edge = 3.65;
        return (
          <Billboard key={lb.id} position={[lb.x, 3.25, lb.z - hd - edge]} follow>
            <Text
              fontSize={1.95}
              fontWeight={800}
              letterSpacing={0.015}
              color="#f8fafc"
              outlineWidth={0.1}
              outlineColor="#020617"
              anchorX="center"
              anchorY="middle"
              maxWidth={26}
              textAlign="center"
              sdfGlyphSize={128}
              depthOffset={-2}
              renderOrder={200}
            >
              {lb.text}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}
