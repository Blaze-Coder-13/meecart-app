import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext(null);

export function CartProvider({ children, userId }) {
  const [cart, setCart] = useState({});

  useEffect(() => {
    // Clear cart and reload when user changes
    setCart({});
    if (userId) {
      loadCart(userId);
    } else {
      // User logged out — clear cart from storage
      AsyncStorage.removeItem('meecart_cart').catch(() => {});
    }
  }, [userId]);

  async function loadCart(uid) {
    try {
      const key = `meecart_cart_${uid}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) setCart(JSON.parse(stored));
      else setCart({});
    } catch {
      setCart({});
    }
  }

  async function saveCart(newCart) {
    setCart(newCart);
    if (userId) {
      await AsyncStorage.setItem(`meecart_cart_${userId}`, JSON.stringify(newCart));
    }
  }

  function addToCart(product) {
    const id = product.product_id || product.id;
    if (!id) return;

    // Flash deals get a special key to avoid collision with regular products
    const cartKey = product.is_flash_deal ? `flash_${id}` : String(id);

    const updated = { ...cart };

    if (updated[cartKey]) {
      // Block flash deals from being added more than once
      if (updated[cartKey].is_flash_deal) {
        return;
      }
      updated[cartKey].qty += 1;
    } else {
      updated[cartKey] = {
        qty: 1,
        name: product.name,
        price: product.price,
        unit: product.unit,
        emoji: product.emoji || product.image_emoji || '🥦',
        image_url: product.image_url || null,
        product_id: id,
        is_flash_deal: product.is_flash_deal || false,
      };
    }
    saveCart(updated);
  }

  function removeFromCart(productId) {
    const updated = { ...cart };
    // Try both regular and flash deal keys
    const key = updated[productId] ? productId : `flash_${productId}`;
    if (updated[key]) {
      if (updated[key].is_flash_deal) {
        delete updated[key]; // remove flash deal entirely
      } else {
        updated[key].qty -= 1;
        if (updated[key].qty <= 0) delete updated[key];
      }
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
      cart, cartItems, cartCount, cartTotal,
      addToCart, removeFromCart, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);