import React, { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, MeshDistortMaterial, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

function GlassTorus({ position = [0, 0, 0], scale = 1 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.getElapsedTime() * 0.3;
    ref.current.rotation.y = clock.getElapsedTime() * 0.4;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <torusKnotGeometry args={[1, 0.32, 220, 32]} />
      <MeshTransmissionMaterial
        thickness={0.6}
        transmission={1}
        roughness={0.05}
        ior={1.4}
        chromaticAberration={0.04}
        anisotropy={0.4}
        distortion={0.4}
        distortionScale={0.4}
        temporalDistortion={0.1}
        color="#D1FF4D"
        attenuationColor="#0A0A0A"
        attenuationDistance={1.4}
        backside
      />
    </mesh>
  );
}

function NeonSphere({ position, color = "#00E5FF" }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.getElapsedTime() * 0.25;
    ref.current.rotation.y = clock.getElapsedTime() * 0.18;
  });
  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[0.55, 1]} />
      <MeshDistortMaterial color={color} distort={0.45} speed={2} roughness={0.1} metalness={0.4} emissive={color} emissiveIntensity={0.35} />
    </mesh>
  );
}

function FloatingCube({ position }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.7) * 0.4;
    ref.current.rotation.y = clock.getElapsedTime() * 0.4;
  });
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <meshStandardMaterial color="#0A0A0A" emissive="#D1FF4D" emissiveIntensity={0.05} metalness={0.9} roughness={0.2} />
      <lineSegments>
        <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(0.71, 0.71, 0.71)]} />
        <lineBasicMaterial attach="material" color="#D1FF4D" linewidth={1} />
      </lineSegments>
    </mesh>
  );
}

export default function Hero3D() {
  return (
    <div className="absolute inset-0 -z-0" data-testid="hero-3d-canvas">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={["#0A0A0A"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />
        <pointLight position={[-3, -2, 2]} color="#D1FF4D" intensity={1.2} />
        <pointLight position={[3, 2, -2]} color="#00E5FF" intensity={0.8} />
        <Suspense fallback={null}>
          <Float speed={1.2} floatIntensity={1.4} rotationIntensity={0.3}>
            <GlassTorus position={[0, 0, 0]} scale={1.05} />
          </Float>
          <Float speed={1.6} floatIntensity={1.6} rotationIntensity={0.4}>
            <NeonSphere position={[-2.4, 1.2, -0.8]} color="#00E5FF" />
          </Float>
          <Float speed={1.4} floatIntensity={1.2} rotationIntensity={0.3}>
            <FloatingCube position={[2.4, -1, -0.6]} />
          </Float>
          <Float speed={1.8} floatIntensity={1.4} rotationIntensity={0.5}>
            <NeonSphere position={[2.6, 1.4, -1.6]} color="#D1FF4D" />
          </Float>
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}
