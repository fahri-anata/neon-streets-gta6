// minimap.js — real-time minimap rendering

import * as THREE from 'three';

export function createMinimap(ctx) {
  const canvas = document.getElementById('minimap');
  if (!canvas) return null;
  
  const size = 150;
  canvas.width = size;
  canvas.height = size;
  
  const mapCtx = canvas.getContext('2d');
  const scale = 2; // meters per pixel
  const range = size * scale / 2;
  
  const minimap = {
    canvas,
    ctx: mapCtx,
    scale,
    range,
    
    render(player, vehicles, city) {
      // Clear
      mapCtx.fillStyle = '#1a1a1a';
      mapCtx.fillRect(0, 0, size, size);
      
      const centerX = size / 2;
      const centerY = size / 2;
      
      // Draw roads
      mapCtx.strokeStyle = '#333';
      mapCtx.lineWidth = 3;
      if (city.network) {
        city.network.edges.forEach(edge => {
          const from = city.network.nodes[edge.from];
          const to = city.network.nodes[edge.to];
          
          const x1 = centerX + (from.x - player.x) / scale;
          const y1 = centerY + (from.z - player.z) / scale;
          const x2 = centerX + (to.x - player.x) / scale;
          const y2 = centerY + (to.z - player.z) / scale;
          
          if (Math.abs(x1 - centerX) < size && Math.abs(y1 - centerY) < size) {
            mapCtx.beginPath();
            mapCtx.moveTo(x1, y1);
            mapCtx.lineTo(x2, y2);
            mapCtx.stroke();
          }
        });
      }
      
      // Draw buildings
      mapCtx.fillStyle = '#444';
      ctx.colliders.forEach(col => {
        if (col.kind !== 'building') return;
        
        const x = centerX + (col.x - player.x) / scale;
        const y = centerY + (col.z - player.z) / scale;
        const w = col.width / scale;
        const h = col.depth / scale;
        
        if (Math.abs(x - centerX) < size && Math.abs(y - centerY) < size) {
          mapCtx.fillRect(x - w/2, y - h/2, w, h);
        }
      });
      
      // Draw vehicles
      mapCtx.fillStyle = '#ff9900';
      if (vehicles && vehicles.vehicles) {
        vehicles.vehicles.forEach(veh => {
        if (veh.role === 'police') {
          mapCtx.fillStyle = '#0066ff';
        } else {
          mapCtx.fillStyle = '#ff9900';
        }
        
        const x = centerX + (veh.x - player.x) / scale;
        const y = centerY + (veh.z - player.z) / scale;
        
        if (Math.abs(x - centerX) < size/2 && Math.abs(y - centerY) < size/2) {
          mapCtx.beginPath();
          mapCtx.arc(x, y, 2, 0, Math.PI * 2);
          mapCtx.fill();
        }
      });
      }
      
      // Draw player
      mapCtx.save();
      mapCtx.translate(centerX, centerY);
      mapCtx.rotate(player.heading);
      
      // Player triangle
      mapCtx.fillStyle = '#00ff00';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -6);
      mapCtx.lineTo(-4, 4);
      mapCtx.lineTo(4, 4);
      mapCtx.closePath();
      mapCtx.fill();
      
      mapCtx.restore();
      
      // Border
      mapCtx.strokeStyle = '#666';
      mapCtx.lineWidth = 2;
      mapCtx.strokeRect(0, 0, size, size);
    },
  };
  
  ctx.minimap = minimap;
  return minimap;
}
