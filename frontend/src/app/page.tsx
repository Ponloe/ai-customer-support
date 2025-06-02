"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2, ShoppingCart, Info, Package, Tag, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Product {
  id: number
  name: string
  price: number
  stock: number
  availability: string
  category: string
  brand: string
  description?: string
}

interface Category {
  id: number
  name: string
  description: string
  product_count: number
}

interface Brand {
  id: number
  name: string
  description: string
  product_count: number
}

export default function ChatPage() {
  const [messages, setMessages] = useState<{ user: string; bot: string; timestamp: string }[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Enhanced suggested questions
  const suggestedQuestions = [
    {
      text: "Do you have iPhone in stock?",
      type: "product",
      icon: <ShoppingCart className="h-4 w-4" />
    },
    {
      text: "Show me all brands",
      type: "brand",
      icon: <Tag className="h-4 w-4" />
    },
    {
      text: "What categories do you have?",
      type: "category",
      icon: <Package className="h-4 w-4" />
    },
    {
      text: "Recommend some products",
      type: "recommendation",
      icon: <Star className="h-4 w-4" />
    }
  ]

  // Load initial data
  useEffect(() => {
    loadSystemData()
  }, [])

  const loadSystemData = async () => {
    try {
      // Load system health
      const healthRes = await fetch("http://localhost:8000/health")
      const healthData = await healthRes.json()
      setSystemStatus(healthData)

      // Load categories
      const categoriesRes = await fetch("http://localhost:8000/categories")
      const categoriesData = await categoriesRes.json()
      setCategories(categoriesData.categories || [])

      // Load brands
      const brandsRes = await fetch("http://localhost:8000/brands")
      const brandsData = await brandsRes.json()
      setBrands(brandsData.brands || [])
    } catch (error) {
      console.error("Failed to load system data:", error)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Format timestamp
  const formatTime = (timestamp?: string) => {
    const date = timestamp ? new Date(timestamp) : new Date()
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date)
  }

  const sendMessage = async (message = input) => {
    if (!message.trim()) return

    const userMessage = message
    const timestamp = new Date().toISOString()
    setInput("")
    setIsLoading(true)

    // Add user message immediately
    setMessages((prev) => [...prev, { user: userMessage, bot: "", timestamp }])

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessage }),
      })

      const data = await res.json()
      const botMessage = data.response

      // Update the last message with the bot response
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].bot = botMessage
        return newMessages
      })
    } catch (error) {
      console.error("Error sending message:", error)
      // Update with error message
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].bot = "Sorry, I'm experiencing technical difficulties. Please try again in a moment."
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Enhanced message formatting for better product display
  const formatBotMessage = (message: string) => {
    const lines = message.split('\n').filter(line => line.trim())
    
    // Check if message contains structured data
    const hasProductInfo = message.includes('===') || message.includes('•')
    
    if (!hasProductInfo) {
      return <div className="prose prose-sm max-w-none">{message}</div>
    }

    return (
      <div className="space-y-3">
        {lines.map((line, i) => {
          const trimmedLine = line.trim()
          
          // Section headers
          if (trimmedLine.includes('===')) {
            const title = trimmedLine.replace(/=/g, '').trim()
            return (
              <div key={i} className="flex items-center gap-2 font-semibold text-primary border-b border-primary/20 pb-1">
                {title.includes('Product') && <ShoppingCart className="h-4 w-4" />}
                {title.includes('Categor') && <Package className="h-4 w-4" />}
                {title.includes('Brand') && <Tag className="h-4 w-4" />}
                <span>{title}</span>
              </div>
            )
          }
          
          // Product items
          if (trimmedLine.startsWith('•')) {
            const content = trimmedLine.substring(1).trim()
            
            // Product with price and stock info
            if (content.includes('$') && content.includes('|')) {
              const parts = content.split('|').map(p => p.trim())
              const name = parts[0] || ''
              const price = parts[1] || ''
              const availability = parts[2] || ''
              const category = parts[3] || ''
              const brand = parts[4] || ''
              
              return (
                <Card key={i} className="border border-primary/20 bg-primary/5">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          <span className="font-medium">{name}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {price && <Badge variant="outline" className="font-mono">{price}</Badge>}
                          {availability.includes('In Stock') && (
                            <Badge className="bg-green-500 text-white">In Stock</Badge>
                          )}
                          {availability.includes('Out of Stock') && (
                            <Badge className="bg-red-500 text-white">Out of Stock</Badge>
                          )}
                          {category && <span>Category: {category}</span>}
                          {brand && <span>Brand: {brand}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }
            
            // Category or brand items
            if (content.includes('(') && content.includes('products)')) {
              const nameMatch = content.match(/^([^(]+)/)
              const countMatch = content.match(/\((\d+) products?\)/)
              const descMatch = content.match(/ - ([^(]+)/)
              
              const name = nameMatch ? nameMatch[1].trim() : ''
              const count = countMatch ? countMatch[1] : '0'
              const description = descMatch ? descMatch[1].trim() : ''
              
              return (
                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{name}</div>
                      {description && <div className="text-sm text-muted-foreground">{description}</div>}
                    </div>
                  </div>
                  <Badge variant="secondary">{count} products</Badge>
                </div>
              )
            }
            
            // Product recommendations with description
            if (content.includes('$') && content.includes(' - ')) {
              const parts = content.split(' - ')
              const nameAndPrice = parts[0]
              const description = parts[1]
              
              const priceMatch = nameAndPrice.match(/\$[\d.]+/)
              const name = nameAndPrice.replace(/\$[\d.]+/, '').replace(/[()]/g, '').trim()
              const price = priceMatch ? priceMatch[0] : ''
              
              return (
                <Card key={i} className="border border-border">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium">{name}</span>
                      {price && <Badge className="font-mono">{price}</Badge>}
                    </div>
                    {description && (
                      <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                  </CardContent>
                </Card>
              )
            }
            
            // Simple list items
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>{content}</span>
              </div>
            )
          }
          
          // Regular text
          if (trimmedLine) {
            return <div key={i} className="text-sm">{trimmedLine}</div>
          }
          
          return null
        })}
      </div>
    )
  }

  const quickAccessButtons = () => (
    <div className="space-y-3">
      {categories.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Quick Categories</h4>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 4).map((category) => (
              <Button
                key={category.id}
                variant="outline"
                size="sm"
                onClick={() => sendMessage(`What products do you have in ${category.name} category?`)}
                className="text-xs"
              >
                <Package className="h-3 w-3 mr-1" />
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {brands.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Popular Brands</h4>
          <div className="flex flex-wrap gap-2">
            {brands.slice(0, 4).map((brand) => (
              <Button
                key={brand.id}
                variant="outline"
                size="sm"
                onClick={() => sendMessage(`What ${brand.name} products do you have?`)}
                className="text-xs"
              >
                <Tag className="h-3 w-3 mr-1" />
                {brand.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-xl">
        <CardHeader className="border-b bg-white py-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <span>ShopBot AI Customer Support</span>
            </div>
            <div className="flex items-center gap-2">
              {systemStatus && (
                <Badge variant={systemStatus.laravel_api === 'connected' ? 'default' : 'destructive'}>
                  <span className={`h-2 w-2 rounded-full mr-1 ${
                    systemStatus.laravel_api === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                  {systemStatus.laravel_api === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Bot className="h-16 w-16 mb-6 text-primary" />
                <h3 className="text-xl font-semibold mb-3">Welcome to AI Customer Support</h3>
                <p className="text-muted-foreground mb-8 max-w-md">
                  I'm your AI assistant that can help you find products, check inventory, and answer various questions about our store.
                </p>
                
                <div className="w-full max-w-2xl space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3 text-muted-foreground">Frequently Asked Questions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {suggestedQuestions.map((question, i) => (
                        <Button 
                          key={i} 
                          variant="outline" 
                          className="text-left justify-start h-auto py-3 hover:bg-primary/5" 
                          onClick={() => sendMessage(question.text)}
                        >
                          {question.icon}
                          <span className="ml-2">{question.text}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {quickAccessButtons()}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-2 pb-4">
                {messages.map((message, index) => (
                  <div key={index} className="space-y-6">
                    {/* User message */}
                    <div className="flex gap-3 w-full justify-end">
                      <div className="flex flex-col max-w-[80%] items-end">
                        <div className="rounded-lg px-4 py-3 bg-primary text-primary-foreground rounded-tr-none shadow-sm">
                          {message.user}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-zinc-800 text-zinc-50">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Bot message or loading indicator */}
                    {message.bot || (isLoading && index === messages.length - 1) ? (
                      <div className="flex gap-3 w-full justify-start">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col max-w-[85%] items-start">
                          <div className="rounded-lg px-4 py-3 bg-muted rounded-tl-none shadow-sm">
                            {isLoading && index === messages.length - 1 ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span>Searching for product information...</span>
                              </div>
                            ) : (
                              formatBotMessage(message.bot)
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t p-4 bg-white">
          <div className="flex w-full gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question here..."
              className="flex-1 focus-visible:ring-primary"
              disabled={isLoading}
            />
            <Button 
              onClick={() => sendMessage()} 
              disabled={isLoading || !input.trim()}
              className="bg-primary hover:bg-primary/90 px-6"
            >
              {isLoading ? 
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 
                <Send className="h-4 w-4 mr-2" />
              }
              Send
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}