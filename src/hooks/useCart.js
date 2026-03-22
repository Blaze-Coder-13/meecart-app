import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({});

  useEffect(() => { loadCart(); }, []);

  async function loadCart() {
    try {
      const stored = await AsyncStorage.getItem('meecart_cart');
      if (stored) setCart(JSON.parse(stored));
    } catch {}
  }

  async function saveCart(newCart) {
    setCart(newCart);
    await AsyncStorage.setItem('meecart_cart', JSON.stringify(newCart));
  }

  function addToCart(product) {
    const updated = { ...cart };
    if (updated[product.id]) {
      updated[product.id].qty += 1;
    } else {
      updated[product.id] = {
        qty: 1,
        name: product.name,
        price: product.price,
        unit: product.unit,
        emoji: product.image_emoji,
        product_id: product.id,
      };
    }
    saveCart(updated);
  }

  function removeFromCart(productId) {
    const updated = { ...cart };
    if (updated[productId]) {
      updated[productId].qty -= 1;
      if (updated[productId].qty <= 0) delete updated[productId];
    }
    saveCart(updated);
  }

  function clearCart() {
    saveCart({});
  }

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider value={{
      cart,
      cartItems,
      cartCount,
      cartTotal,
      addToCart,
      removeFromCart,
      clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
