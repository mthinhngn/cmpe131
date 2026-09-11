import { useEffect, useRef } from "react";
import * as THREE from "three";

type GraphDepthCanvasProps = {
  focusKey: string | null;
};

function hashPosition(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return {
    x: ((Math.abs(hash) % 100) / 100 - 0.5) * 8,
    y: ((Math.abs(hash >> 8) % 100) / 100 - 0.5) * 6,
  };
}

export function GraphDepthCanvas({ focusKey }: GraphDepthCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneState = useRef<{
    orbit: THREE.Mesh;
    orbitMaterial: THREE.MeshStandardMaterial;
    accentLight: THREE.PointLight;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      canvas.dataset.unavailable = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0.4, 10);

    const relief = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 14, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8e1d4, roughness: 0.92, metalness: 0.02, transparent: true, opacity: 0.56 }),
    );
    relief.rotation.x = -0.08;
    relief.position.z = -1.25;
    scene.add(relief);

    const grid = new THREE.GridHelper(18, 24, 0x9e917c, 0xbdb3a4);
    grid.rotation.x = Math.PI / 2 - 0.08;
    grid.position.set(0, 0, -1.1);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach(material => { material.transparent = true; material.opacity = 0.13; });
    scene.add(grid);

    const markerGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.11, 16);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x415d68, roughness: 0.45, metalness: 0.18 });
    const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, 42);
    const markerTransform = new THREE.Object3D();
    for (let index = 0; index < 42; index += 1) {
      const column = index % 7;
      const row = Math.floor(index / 7);
      markerTransform.position.set(-6.8 + column * 2.25, 4.75 - row * 1.85, -0.92 + Math.sin(index * 1.7) * 0.05);
      markerTransform.rotation.x = Math.PI / 2;
      markerTransform.updateMatrix();
      markers.setMatrixAt(index, markerTransform.matrix);
    }
    scene.add(markers);

    const orbitMaterial = new THREE.MeshStandardMaterial({ color: 0xa57b32, roughness: 0.4, metalness: 0.28, transparent: true, opacity: 0.38 });
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 10, 80), orbitMaterial);
    const target = hashPosition("course-radar");
    orbit.position.set(target.x, target.y, -0.72);
    orbit.rotation.x = 0.22;
    scene.add(orbit);

    scene.add(new THREE.AmbientLight(0xfff8e9, 1.25));
    const keyLight = new THREE.DirectionalLight(0xf8e7c0, 1.1);
    keyLight.position.set(-4, 7, 8);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(0xb58a3f, 1.1, 8, 2);
    accentLight.position.set(target.x, target.y, 2.2);
    scene.add(accentLight);
    sceneState.current = { orbit, orbitMaterial, accentLight, active: false };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const timer = new THREE.Timer();
    timer.connect(document);
    let frame = 0;
    const render = (timestamp?: number) => {
      timer.update(timestamp);
      const elapsed = timer.getElapsed();
      if (!reduceMotion) {
        orbit.rotation.z = elapsed * 0.08;
        orbit.position.z = -0.72 + Math.sin(elapsed * 0.7) * 0.045;
        const pulse = 1 + Math.sin(elapsed * 1.25) * (sceneState.current?.active ? 0.045 : 0.018);
        orbit.scale.setScalar(pulse);
        camera.position.x = Math.sin(elapsed * 0.12) * 0.07;
        camera.position.y = 0.4 + Math.cos(elapsed * 0.1) * 0.045;
      }
      renderer.render(scene, camera);
      if (!reduceMotion) frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      timer.dispose();
      observer.disconnect();
      markerGeometry.dispose();
      markerMaterial.dispose();
      orbit.geometry.dispose();
      orbitMaterial.dispose();
      relief.geometry.dispose();
      (relief.material as THREE.Material).dispose();
      gridMaterials.forEach(material => material.dispose());
      renderer.dispose();
      sceneState.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneState.current;
    if (!state) return;
    const target = hashPosition(focusKey ?? "course-radar");
    state.orbit.position.x = target.x;
    state.orbit.position.y = target.y;
    state.orbitMaterial.color.setHex(focusKey ? 0x8b3f48 : 0xa57b32);
    state.orbitMaterial.opacity = focusKey ? 0.72 : 0.38;
    state.accentLight.color.setHex(focusKey ? 0x9a4651 : 0xb58a3f);
    state.accentLight.intensity = focusKey ? 2.25 : 1.1;
    state.accentLight.position.set(target.x, target.y, 2.2);
    state.active = Boolean(focusKey);
  }, [focusKey]);

  return <canvas ref={canvasRef} className="graph-depth-canvas" aria-hidden="true" />;
}
