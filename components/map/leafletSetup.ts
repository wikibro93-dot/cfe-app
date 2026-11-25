import L from "leaflet";
// Static image imports: Next.js bundles these from the leaflet package and
// serves them same-origin, so no CDN and no CSP exception are needed.
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

/**
 * Point Leaflet's default marker icons at the bundled copies from the
 * leaflet package. The marker images used to come from cdnjs, but the app's
 * Content-Security-Policy does not allow cdnjs (style-src / img-src), so
 * markers loaded no image at all. Idempotent — safe to call from every
 * map component.
 */
let fixed = false;

export function fixLeafletIcons() {
  if (fixed) return;
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x.src,
    iconUrl: markerIcon.src,
    shadowUrl: markerShadow.src,
  });
  fixed = true;
}
