import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
    ShoppingBag,
    ArrowRight,
    ChevronRight,
    Star,
    Clock,
    ShieldCheck,
    Truck,
    Sparkles,
    Instagram,
    Mail,
    Heart,
    Quote
} from "lucide-react";

const HERO_IMAGES = [
    "/images/hero-user-0.jpg",
    "/images/hero-user-1.jpg",
    "/images/hero-user-2.jpg"
];

export default function LandingPage() {
    const [currentImage, setCurrentImage] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImage((prev) => (prev + 1) % HERO_IMAGES.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen bg-brand-background font-sans">
            {/* Global Smooth Scroll & Custom Keyframes */}
            <style dangerouslySetInnerHTML={{
                __html: `
                html { scroll-behavior: smooth; }
                @keyframes kenburns {
                    0% { transform: scale(1) translate(0, 0); }
                    100% { transform: scale(1.15) translate(-1%, -1%); }
                }
                @keyframes dynamic-reveal {
                    0% { opacity: 0; transform: translateY(40px) scale(0.95); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-kenburns {
                    animation: kenburns 15s ease-in-out infinite alternate;
                }
                .animate-dynamic-reveal {
                    animation: dynamic-reveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                    opacity: 0;
                }
                .text-glow {
                    text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
                }
            `}} />

            {/* Premium Navigation */}
            <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-brand-charcoal/10 backdrop-blur-md transition-all duration-500">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-8 py-4 sm:py-6">
                    <div className="flex items-center space-x-6 sm:space-x-12">
                        <Link to="/" className="text-2xl sm:text-3xl font-black tracking-tighter text-white">Seoulful<span className="text-brand-primary">.</span></Link>
                        <div className="hidden space-x-10 text-[10px] font-black uppercase tracking-[0.4em] text-white/50 lg:flex">
                            <a href="#menu" className="hover:text-white transition-colors">Menu</a>
                            <a href="#story" className="hover:text-white transition-colors">Story</a>
                            <a href="#how-it-works" className="hover:text-white transition-colors">Process</a>
                        </div>
                    </div>
                    <Button asChild className="rounded-xl bg-brand-primary px-4 sm:px-8 text-[10px] sm:text-xs font-black uppercase tracking-widest text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20">
                        <Link to="/order" prefetch="viewport">Order Now</Link>
                    </Button>
                </div>
            </nav>

            {/* Elevated Hero Section with Slideshow */}
            <section className="relative h-screen min-h-[800px] w-full overflow-hidden bg-brand-charcoal">
                <div className="absolute inset-0 z-0">
                    {HERO_IMAGES.map((img, idx) => (
                        <div
                            key={img}
                            className={`absolute inset-0 transition-opacity duration-[4000ms] ease-in-out ${idx === currentImage ? "opacity-100" : "opacity-0"
                                }`}
                        >
                            <img
                                src={img}
                                alt="Seoulful Bakery Hero"
                                className="h-full w-full object-cover animate-kenburns"
                                style={{ animationDelay: `${idx * -7}s` }}
                            />
                        </div>
                    ))}

                    {/* Dynamic Overlays - Reduced Opacity for better visibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal via-brand-charcoal/20 to-transparent opacity-70" />
                    <div className="absolute inset-0 bg-oven-glow mix-blend-screen opacity-20" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,140,0,0.05),_transparent_60%)]" />
                </div>

                <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-8 pt-20 sm:pt-24 lg:pt-28">
                    <div className="max-w-4xl space-y-8 sm:space-y-12">
                        <div className="inline-flex items-center space-x-4 glass px-4 sm:px-6 py-2 rounded-full animate-dynamic-reveal">
                            <Sparkles className="text-brand-primary animate-pulse" size={16} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/90">Premium Korean Bakery</span>
                        </div>

                        <div className="space-y-2 sm:space-y-4">
                            <h1 className="leading-[1.1] text-white selection:bg-brand-primary">
                                <span className="block text-4xl sm:text-7xl lg:text-8xl font-serif italic font-light animate-dynamic-reveal [animation-delay:200ms] text-white/90">Taste of</span>
                                <span className="block text-6xl font-bold tracking-tight sm:text-9xl lg:text-[9rem] animate-dynamic-reveal [animation-delay:400ms] mt-2 sm:mt-4">
                                    Seoul<span className="text-brand-primary">.</span>
                                </span>
                            </h1>
                        </div>

                        <p className="max-w-xl text-lg sm:text-xl lg:text-2xl leading-relaxed text-white/60 font-light animate-dynamic-reveal [animation-delay:600ms]">
                            Bringing the soul of Korean baking to India.
                            Handcrafted in small batches with premium flour and <span className="text-white/80 italic font-serif">unmatched sincerity.</span>
                        </p>

                        <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-8 sm:space-y-0 animate-dynamic-reveal [animation-delay:800ms]">
                            <Button asChild size="lg" className="h-14 sm:h-18 rounded-xl bg-brand-primary px-8 sm:px-12 text-base sm:text-lg font-black uppercase tracking-widest transition-all hover:scale-105 hover:bg-brand-primary/90 hover:shadow-[0_20px_50px_rgba(207,99,23,0.4)]">
                                <Link to="/order" prefetch="render">Pre-order Now</Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="h-14 sm:h-18 rounded-xl glass border-white/10 px-8 sm:px-12 text-base sm:text-lg font-black uppercase tracking-widest text-white transition-all hover:bg-white hover:text-brand-charcoal">
                                <a href="#menu">View Menu</a>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Vertical Branding */}
                <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center space-y-12 animate-dynamic-reveal [animation-delay:1000ms]">
                    <div className="h-40 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                    <span className="rotate-90 text-[10px] font-black uppercase tracking-[0.5em] text-white/20 whitespace-nowrap">Bread with Sincerity</span>
                    <div className="h-40 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                </div>
            </section>

            {/* Brand Story */}
            <section id="story" className="py-32 bg-white/50">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center space-y-6 sm:space-y-8">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">The Seoulful Standard</h2>
                    <p className="text-lg sm:text-xl leading-relaxed text-brand-charcoal/80 font-light">
                        Bringing the heart of Korean baking to your home with unmatched quality and care.
                        Emphasizing slow baking and the art of patience—every loaf is a testament to our dedication
                        to quality and the warmth of Korean traditions.
                    </p>
                    <div className="flex justify-center">
                        <div className="h-20 w-px bg-gradient-to-b from-brand-primary to-transparent" />
                    </div>
                </div>
            </section>

            {/* Cinematic Features Section */}
            <section className="py-32 bg-brand-background relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-[radial-gradient(circle_at_100%_0%,_rgba(207,99,23,0.05),_transparent_70%)]" />

                <div className="mx-auto max-w-7xl px-4 sm:px-8">
                    <div className="grid gap-12 sm:gap-16 md:grid-cols-3">
                        {[
                            {
                                title: "Small-batch Sincerity",
                                desc: "Every loaf is baked in strictly limited quantities. We focus on quality over volume, ensuring each piece is perfect.",
                                label: "QUALITY"
                            },
                            {
                                title: "Honest Ingredients",
                                desc: "No artificial enhancers. Pure organic milk, premium artisan flour, and traditional slow-fermentation techniques.",
                                label: "PURITY"
                            },
                            {
                                title: "Korean Tradition",
                                desc: "Meeting the vibrant spirit of modern India with the disciplined heart of authentic Korean bakery traditions.",
                                label: "HERITAGE"
                            }
                        ].map((feature, i) => (
                            <div key={i} className="space-y-8 group">
                                <div className="space-y-3 sm:space-y-4">
                                    <span className="text-[10px] font-black tracking-[0.4em] text-brand-primary">{feature.label}</span>
                                    <h3 className="text-3xl sm:text-4xl font-black leading-none">{feature.title}</h3>
                                </div>
                                <div className="h-px w-12 bg-brand-charcoal/10 transition-all duration-500 group-hover:w-full group-hover:bg-brand-primary" />
                                <p className="text-lg sm:text-xl text-brand-charcoal/50 leading-relaxed font-light">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Signature Menu - Visual Focus */}
            <section id="menu" className="py-40 bg-white">
                <div className="mx-auto max-w-[1400px] px-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 sm:mb-24 gap-8 sm:gap-12">
                        <div className="space-y-4 sm:space-y-6">
                            <h2 className="text-5xl sm:text-7xl font-black tracking-tight leading-[0.9] uppercase">Full-Flavored<br /><span className="text-brand-primary">Signatures.</span></h2>
                            <p className="text-xl sm:text-2xl text-brand-charcoal/40 max-w-md font-light">Crafted once, loved forever. Discover our most celebrated creations.</p>
                        </div>
                        <Button variant="link" asChild className="p-0 h-auto text-xs font-black uppercase tracking-[0.4em] text-brand-charcoal hover:text-brand-primary no-underline transition-all">
                            <Link to="/order" prefetch="viewport" className="flex items-center gap-4">
                                <span>Explore Catalog</span>
                                <div className="h-[1px] w-12 bg-brand-charcoal/20 transition-all group-hover:w-20 group-hover:bg-brand-primary" />
                            </Link>
                        </Button>
                    </div>

                    <div className="grid gap-12 lg:grid-cols-3">
                        {[
                            { name: "Salt Bread", nameKo: "소금빵", price: "₹120", tag: "SIGNATURE", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAipp36g36cissaP_E217_43UKSwHBDMb8HKWVCvXQO36Ge12Z9JLksWN-dOvh7uOcOINMJZ14W5dCVmlIj10TJKB01eAKyIvlVB2HTxmg9xZgSc2TmQ18pIDc7Sm-3bB44Z9yJqdxhM794-FyFrzlRZMIiyhxq77J8GM5Jw3XpO9XppdBxOcG2JPOFG-_gpIEhICyD1ucg0MvJcQlmONaW902Bs0h5cwqsDCT0pFuAN5rcpe4WJC3oRsrBsgPp5vtEvZML-I0ZSLE" },
                            { name: "Scones", nameKo: "스콘", price: "₹150", tag: "MUST TRY", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDMP0ZEqFCqsUdVifva84HDQBxEpXzEVlyY15F0m-jPgqGue6FKBuR_s48w3nV8dOK6SI1bgYRSvk6oEE0yyFOD6zn5KA8-z8gBTwOvn_-jXWx-sUjbjJLFeot14Wfl-x1FoftlxUhYqJ1DtoeElZnkLDxNWjLzSdTmD9pxXRA8us-f6_ODZ08DIORkC9ImMwGY8wranDuapMf_Ei8SyoU8XuqWyhN0NqcPk5M9MLeFqxgtPzbQfRuICm1lE5QYDHjTEk0brjo8VFA" },
                            { name: "Milk Bread", nameKo: "식빵", price: "₹220", tag: "DAILY", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBmqDbHxOfWQ-pguTSv-hPtN6nKeGsybpo2czDZrQzhXu7Gx27Ku5mOhx6-q1voP0RkqXF6ocuijiF2Kdw46h7496q9FfqPtIl8d1b829sakqFyJsv1EBDZVHrT8xn51khv_riGWeSWox7ttpmMYRGSOivACdesDizKhbvP6B4qKUzGVJQBeAKkf-3RgaER3KKlLO57okD44hijDYDHYTWLuwROOoemfEgq8oZqA82mRvGk5jw40c4W3VGnw6pIpcdj5JdRJ_xf1JI" }
                        ].map((item, i) => (
                            <div key={i} className="group relative">
                                <div className="aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-brand-background">
                                    <img src={item.img} alt={item.name} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/80 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                                    <div className="absolute bottom-10 left-10 right-10 translate-y-8 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                                        <Button asChild className="w-full h-16 rounded-2xl bg-white text-brand-charcoal font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white border-none">
                                            <Link to="/order" prefetch="viewport">Order Quick</Link>
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-6 sm:mt-8 flex justify-between items-start px-2 sm:px-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black tracking-widest text-brand-primary uppercase">{item.tag}</span>
                                        <h4 className="text-2xl sm:text-4xl font-black uppercase tracking-tight">{item.name}</h4>
                                        <p className="text-brand-charcoal/30 font-bold text-sm sm:text-base">{item.nameKo}</p>
                                    </div>
                                    <span className="text-xl sm:text-2xl font-black text-brand-charcoal">{item.price}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Process Section - Abstract Design */}
            <section id="how-it-works" className="py-40 bg-brand-charcoal text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,_rgba(255,255,255,0.03),_transparent_50%)]" />

                <div className="mx-auto max-w-7xl px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                        <div className="space-y-8 lg:space-y-12">
                            <div className="space-y-4 lg:space-y-6">
                                <span className="text-[10px] font-black tracking-[0.4em] text-brand-primary uppercase">The Journey</span>
                                <h2 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.9] uppercase">From Oven<br />to Doorstep.</h2>
                            </div>
                            <p className="text-xl lg:text-2xl text-white/40 font-light max-w-md leading-relaxed">A meticulous process designed to bring you bread as it was meant to be: fresh, honest, and seoulful.</p>

                            <div className="pt-8">
                                <Button asChild className="h-16 rounded-xl bg-white text-brand-charcoal font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all">
                                    <Link to="/order" prefetch="viewport">Start Your Order</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-16">
                            {[
                                { step: "01", title: "Reserve by 8 PM", desc: "Our day ends when your choices are made. We gather all orders by 8 PM to plan the night's bake." },
                                { step: "02", title: "Midnight Alchemy", desc: "While the world sleeps, our bakers begin the slow fermentation and careful shaping of every loaf." },
                                { step: "03", title: "Fresh Awakening", desc: "Early morning delivery ensures the warmth of our ovens reaches your home by the afternoon." }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-6 lg:gap-10 group">
                                    <span className="text-3xl lg:text-4xl font-black text-brand-primary opacity-40 group-hover:opacity-100 transition-opacity font-mono">{item.step}</span>
                                    <div className="space-y-3 lg:space-y-4">
                                        <h3 className="text-2xl lg:text-3xl font-black uppercase tracking-tight">{item.title}</h3>
                                        <p className="text-base lg:text-lg text-white/40 font-light leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonial Section - Refined Emotional Sans */}
            <section className="py-48 bg-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,_rgba(207,99,23,0.02),_transparent_50%)]" />

                <div className="mx-auto max-w-5xl px-4 sm:px-8 text-center space-y-12 sm:space-y-16 relative z-10">
                    <div className="flex justify-center">
                        <Quote className="text-brand-primary/10" size={100} fill="currentColor" />
                    </div>

                    <p className="text-2xl sm:text-3xl md:text-5xl font-bold italic leading-tight text-brand-charcoal/70 selection:bg-brand-primary/10 tracking-tight">
                        "The milk bread reminds me of my childhood in Seoul - soft, pillowy, and filled with warmth. It's more than just bread; <span className="text-brand-primary not-italic">it's home."</span>
                    </p>

                    <div className="pt-8 space-y-3">
                        <div className="h-px w-24 bg-brand-charcoal/5 mx-auto" />
                        <p className="text-sm font-black tracking-[0.6em] text-brand-charcoal uppercase">JI-WON PARK</p>
                        <p className="text-[10px] font-bold text-brand-charcoal/30 uppercase tracking-[0.3em]">LOYAL CUSTOMER SINCE 2025</p>
                    </div>
                </div>
            </section>

            {/* Newsletter - Integrated Design */}
            <section className="pb-20 sm:pb-40 px-4 sm:px-8">
                <div className="mx-auto max-w-7xl bg-brand-primary rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-16 md:p-32 text-white relative overflow-hidden text-center group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.2),_transparent_70%)]" />
                    <div className="relative z-10 max-w-2xl mx-auto space-y-8 sm:space-y-12">
                        <h2 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-none uppercase">Join the<br />Seoulful Club.</h2>
                        <p className="text-lg sm:text-xl md:text-2xl font-medium opacity-80 leading-relaxed">Receive weekly specials and <span className="underline decoration-4 underline-offset-8">10% off</span> your first artisan pre-order.</p>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <input
                                type="email"
                                placeholder="YOUR@EMAIL.COM"
                                className="h-14 sm:h-18 flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl px-6 sm:px-10 text-white placeholder:text-white/40 font-black tracking-widest focus:outline-none focus:ring-4 focus:ring-white/10 transition-all uppercase text-sm"
                            />
                            <Button className="h-14 sm:h-18 px-12 rounded-xl sm:rounded-2xl bg-white text-brand-primary font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">
                                Subscribe
                            </Button>
                        </div>
                    </div>
                </div>
            </section >

            {/* Footer - Brutalist Luxe */}
            < footer className="bg-brand-background text-brand-charcoal pt-20 sm:pt-32 pb-12 sm:pb-16" >
                <div className="mx-auto max-w-7xl px-4 sm:px-8">
                    <div className="grid gap-12 sm:gap-16 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
                        <div className="col-span-2 space-y-8 sm:space-y-10">
                            <Link to="/" className="text-3xl sm:text-4xl font-black tracking-tighter">Seoulful<span className="text-brand-primary">.</span></Link>
                            <p className="max-w-xs text-brand-charcoal/40 leading-relaxed text-lg sm:text-xl font-light">
                                Premium artisan bakery bringing the slow-baked sincerity of Seoul to India.
                            </p>
                            <div className="flex space-x-6">
                                <Link to="#" className="text-brand-charcoal hover:text-brand-primary transition-colors">
                                    <Instagram size={28} />
                                </Link>
                                <Link to="#" className="text-brand-charcoal hover:text-brand-primary transition-colors">
                                    <Mail size={28} />
                                </Link>
                            </div>
                        </div>
                        <div>
                            <h5 className="mb-8 font-black text-[10px] uppercase tracking-[0.4em] text-brand-charcoal/20">Explore</h5>
                            <ul className="space-y-4 text-sm font-black uppercase tracking-widest transition-all">
                                <li><a href="#menu" className="hover:text-brand-primary">Catalog</a></li>
                                <li><a href="#story" className="hover:text-brand-primary">Our Story</a></li>
                                <li><Link to="/order" prefetch="viewport" className="hover:text-brand-primary">Order Now</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="mb-8 font-black text-[10px] uppercase tracking-[0.4em] text-brand-charcoal/20">Information</h5>
                            <ul className="space-y-4 text-sm font-black uppercase tracking-widest transition-all">
                                <li><Link to="#" className="hover:text-brand-primary">Shipping</Link></li>
                                <li><Link to="#" className="hover:text-brand-primary">Contact</Link></li>
                                <li><Link to="#" className="hover:text-brand-primary">FAQs</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="mb-8 font-black text-[10px] uppercase tracking-[0.4em] text-brand-charcoal/20">Legal</h5>
                            <ul className="space-y-4 text-sm font-black uppercase tracking-widest transition-all">
                                <li><Link to="#" className="hover:text-brand-primary">Privacy</Link></li>
                                <li><Link to="#" className="hover:text-brand-primary">Terms</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-40 border-t border-brand-charcoal/5 pt-12 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-brand-charcoal/30">
                        <p>© 2024 SEOULFUL BAKERY INDIA. HANDCRAFTED WITH SINCERITY.</p>
                        <p className="flex items-center space-x-3">
                            <span>Crafted with</span>
                            <Heart size={14} className="fill-brand-primary text-brand-primary" />
                            <span>and Premium Flour</span>
                        </p>
                    </div>
                </div>
            </footer >
        </div >
    );
}
