export const isShopOpen = (open: string, close: string) => {
  if (!open || !close) return true;

  const now = new Date();
  console.log("Time", now.toLocaleString());
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = open.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const [closeH, closeM] = close.split(":").map(Number);
  let closeMinutes = closeH * 60 + closeM;
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }
  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
};
