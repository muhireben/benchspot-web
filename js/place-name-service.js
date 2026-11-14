export class PlaceNameService {
  async lookup(location) {
    const query = new URLSearchParams({
      format: "jsonv2",
      lat: String(location.lat),
      lon: String(location.lng),
      zoom: "18",
      addressdetails: "1",
      namedetails: "1",
    });
    const response = await fetch("https://nominatim.openstreetmap.org/reverse?" + query.toString(), {
      headers: { "Accept-Language": "en,fr,nl" },
    });
    if (!response.ok) {
      throw new Error("Nearby place lookup returned HTTP " + response.status + ".");
    }
    const result = await response.json();
    const address = result.address || {};
    return result.name || (result.namedetails && result.namedetails.name) ||
      address.park || address.leisure || address.neighbourhood || address.suburb ||
      address.village || address.town || address.city || "";
  }
}
