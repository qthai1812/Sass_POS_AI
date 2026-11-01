import React, { useState } from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const { toast } = useToast();

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address to subscribe.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Subscribed Successfully!",
      description: `You've been added to our newsletter with ${newsletterEmail}.`,
    });
    setNewsletterEmail('');
  };

  const scrollToSection = (e, id) => {
    e.preventDefault();
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <footer className="bg-card text-card-foreground border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div
              onClick={(e) => scrollToSection(e, 'top')}
              className="flex items-center mb-4 cursor-pointer"
            >
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center mr-2">
                <span className="text-primary-foreground font-bold text-lg">P</span>
              </div>
              <span className="text-foreground font-bold text-xl">POSPro</span>
            </div>
            <p className="mb-4 text-muted-foreground max-w-md">
              Empowering retailers with smart point-of-sale solutions that streamline operations, 
              boost sales, and enhance customer experiences.
            </p>
            <div className="flex space-x-4 mb-6">
              {[
                { name: 'Facebook', icon: <Facebook className="h-5 w-5" />, url: 'https://facebook.com' },
                { name: 'Twitter', icon: <Twitter className="h-5 w-5" />, url: 'https://twitter.com' },
                { name: 'Instagram', icon: <Instagram className="h-5 w-5" />, url: 'https://instagram.com' },
                { name: 'LinkedIn', icon: <Linkedin className="h-5 w-5" />, url: 'https://linkedin.com' },
                { name: 'YouTube', icon: <Youtube className="h-5 w-5" />, url: 'https://youtube.com' },
              ].map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.name}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {social.icon}
                </a>
              ))}
            </div>
            
            <div>
              <h4 className="text-foreground font-medium mb-3">Subscribe to our newsletter</h4>
              <form onSubmit={handleSubscribe} className="flex">
                <input 
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Your email address" 
                  className="bg-background text-foreground px-4 py-2 rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary flex-grow border border-input"
                />
                <Button type="submit" className="rounded-l-none" aria-label="Subscribe">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
          
          <div>
            <h4 className="text-foreground font-medium text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="#top" onClick={(e) => scrollToSection(e, 'top')} className="text-muted-foreground hover:text-foreground transition-colors">Home</a></li>
              <li><a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#live-demo" onClick={(e) => scrollToSection(e, 'live-demo')} className="text-muted-foreground hover:text-foreground transition-colors">Live Demo</a></li>
              <li><a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="text-muted-foreground hover:text-foreground transition-colors">Testimonials</a></li>
              <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-foreground font-medium text-lg mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="text-muted-foreground hover:text-foreground transition-colors">Help Center & FAQ</a></li>
              <li><a href="#feature-comparison" onClick={(e) => scrollToSection(e, 'feature-comparison')} className="text-muted-foreground hover:text-foreground transition-colors">Feature Comparison</a></li>
              <li><a href="#mobile-app" onClick={(e) => scrollToSection(e, 'mobile-app')} className="text-muted-foreground hover:text-foreground transition-colors">Download Mobile App</a></li>
              <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="text-muted-foreground hover:text-foreground transition-colors">Partner Program</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-foreground font-medium text-lg mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start">
                <Mail className="h-5 w-5 mr-2 mt-0.5 text-muted-foreground" />
                <a href="mailto:support@pospro.com" className="text-muted-foreground hover:text-foreground">support@pospro.com</a>
              </li>
              <li className="text-muted-foreground">
                <p>123 Tech Park, Whitefield</p>
                <p>Bangalore, Karnataka 560066</p>
              </li>
              <li className="text-muted-foreground">
                <a href="tel:+919876543210" className="hover:text-foreground">+91 98765 43210</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              <p>&copy; {currentYear} POSPro. All rights reserved.</p>
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0 text-sm">
              <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</a>
              <a href="#top" onClick={(e) => scrollToSection(e, 'top')} className="text-muted-foreground hover:text-foreground transition-colors">Back to Top</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
