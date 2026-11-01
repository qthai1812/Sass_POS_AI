import { ShoppingCart, Menu, X, ChevronDown } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Button } from '../../../components/ui/button'
import { useNavigate } from 'react-router'
import { ThemeToggle } from '../../../components/theme-toggle'

const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)
    const [activeDropdown, setActiveDropdown] = useState(null)
    const navigate = useNavigate();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const handleLoginButtonClick = () => {
        setIsMenuOpen(false);
        navigate('/auth/login');
    }

    const scrollToSection = (e, sectionId) => {
        if (e) e.preventDefault();
        setActiveDropdown(null);
        setIsMenuOpen(false);
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            navigate(`/#${sectionId}`);
        }
    }

    const handleRequestDemo = () => {
        scrollToSection(null, 'contact');
    }
    
    const toggleDropdown = (name) => {
        setActiveDropdown(activeDropdown === name ? null : name)
    }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-background/95 shadow-md backdrop-blur-sm border-b' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-2 group cursor-pointer" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); navigate('/'); }}>
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 transform group-hover:scale-105">
                  <ShoppingCart className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">POS Pro</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              {/* Features Dropdown */}
              <div className="relative group">
                <button 
                  type="button"
                  onClick={() => toggleDropdown('features')} 
                  className="flex items-center space-x-1 text-muted-foreground hover:text-primary transition-colors py-2"
                >
                  <span>Features</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'features' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'features' && (
                  <div className="absolute left-0 mt-2 w-52 bg-popover rounded-lg shadow-lg border border-border py-2 z-50">
                    <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Overview</a>
                    <a href="#live-demo" onClick={(e) => scrollToSection(e, 'live-demo')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Inventory Management</a>
                    <a href="#live-demo" onClick={(e) => scrollToSection(e, 'live-demo')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Billing & Checkout</a>
                    <a href="#feature-comparison" onClick={(e) => scrollToSection(e, 'feature-comparison')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Analytics & Reports</a>
                  </div>
                )}
              </div>
              
              <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="text-muted-foreground hover:text-primary transition-colors py-2">Pricing</a>
              <a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="text-muted-foreground hover:text-primary transition-colors py-2">Testimonials</a>
              
              {/* Resources Dropdown */}
              <div className="relative group">
                <button 
                  type="button"
                  onClick={() => toggleDropdown('resources')} 
                  className="flex items-center space-x-1 text-muted-foreground hover:text-primary transition-colors py-2"
                >
                  <span>Resources</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'resources' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'resources' && (
                  <div className="absolute left-0 mt-2 w-48 bg-popover rounded-lg shadow-lg border border-border py-2 z-50">
                    <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Help Center</a>
                    <a href="#feature-comparison" onClick={(e) => scrollToSection(e, 'feature-comparison')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Documentation</a>
                    <a href="#live-demo" onClick={(e) => scrollToSection(e, 'live-demo')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Interactive Demo</a>
                    <a href="#mobile-app" onClick={(e) => scrollToSection(e, 'mobile-app')} className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">Mobile App</a>
                  </div>
                )}
              </div>
              
              <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="text-muted-foreground hover:text-primary transition-colors py-2">Contact</a>
            </nav>

            {/* CTA Button */}
            <div className="hidden md:flex items-center space-x-4">
              <ThemeToggle />
              <Button onClick={handleLoginButtonClick} variant="outline" className="font-medium">Sign In</Button>
              <Button onClick={handleRequestDemo} className="font-medium shadow-md hover:shadow-lg transition-shadow">Request Demo</Button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-muted-foreground hover:text-primary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-border bg-background">
              <nav className="flex flex-col">
                <div className="py-2 border-b border-border">
                  <button 
                    type="button"
                    onClick={() => toggleDropdown('mobile-features')} 
                    className="flex items-center justify-between w-full px-4 py-2 text-muted-foreground hover:text-primary"
                  >
                    <span>Features</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'mobile-features' ? 'rotate-180' : ''}`} />
                  </button>
                  {activeDropdown === 'mobile-features' && (
                    <div className="mt-2 pl-8 space-y-2">
                      <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Overview</a>
                      <a href="#live-demo" onClick={(e) => scrollToSection(e, 'live-demo')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Inventory Management</a>
                      <a href="#live-demo" onClick={(e) => scrollToSection(e, 'live-demo')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Billing & Checkout</a>
                      <a href="#feature-comparison" onClick={(e) => scrollToSection(e, 'feature-comparison')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Analytics & Reports</a>
                    </div>
                  )}
                </div>
                
                <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="px-4 py-4 text-muted-foreground hover:text-primary border-b border-border">Pricing</a>
                <a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="px-4 py-4 text-muted-foreground hover:text-primary border-b border-border">Testimonials</a>
                
                <div className="py-2 border-b border-border">
                  <button 
                    type="button"
                    onClick={() => toggleDropdown('mobile-resources')} 
                    className="flex items-center justify-between w-full px-4 py-2 text-muted-foreground hover:text-primary"
                  >
                    <span>Resources</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'mobile-resources' ? 'rotate-180' : ''}`} />
                  </button>
                  {activeDropdown === 'mobile-resources' && (
                    <div className="mt-2 pl-8 space-y-2">
                      <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Help Center</a>
                      <a href="#feature-comparison" onClick={(e) => scrollToSection(e, 'feature-comparison')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Documentation</a>
                      <a href="#live-demo" onClick={(e) => scrollToSection(e, 'live-demo')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Interactive Demo</a>
                      <a href="#mobile-app" onClick={(e) => scrollToSection(e, 'mobile-app')} className="block py-2 text-sm text-muted-foreground hover:text-primary">Mobile App</a>
                    </div>
                  )}
                </div>
                
                <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="px-4 py-4 text-muted-foreground hover:text-primary border-b border-border">Contact</a>
                
                <div className="flex flex-col space-y-3 p-4">
                  <Button onClick={handleLoginButtonClick} variant="outline" className="w-full">Sign In</Button>
                  <Button onClick={handleRequestDemo} className="w-full">Request Demo</Button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>
  )
}

export default Header
