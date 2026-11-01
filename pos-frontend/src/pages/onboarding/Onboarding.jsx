import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import OwnerDetailsForm from './OwnerDetailsForm';
import StoreDetailsForm from './StoreDetailsForm';
import { signup } from '../../Redux Toolkit/features/auth/authThunk';
import { createStore, getStoreByAdmin } from '../../Redux Toolkit/features/store/storeThunks';
import { getUserProfile } from '../../Redux Toolkit/features/user/userThunks';
import { useNavigate } from 'react-router';

const Onboarding = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [fadeIn, setFadeIn] = useState(true);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    storeType: '',
    storeAddress: '',
  });
  const [localError, setLocalError] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      const jwt = localStorage.getItem('jwt');

      if (jwt) {
        setLocalLoading(true);
        try {
          const userRes = await dispatch(getUserProfile(jwt)).unwrap();
          if (userRes && userRes.role === 'ROLE_STORE_ADMIN') {
            try {
              const storeRes = await dispatch(getStoreByAdmin(jwt)).unwrap();
              if (storeRes && storeRes.id) {
                navigate('/store');
                return;
              } else {
                setStep(2);
              }
            } catch {
              setStep(2);
            }
          }
        } catch {
          localStorage.removeItem('jwt');
        }
        setLocalLoading(false);
      }
    };
    checkOnboarding();
  }, [dispatch, navigate]);

  const handleStepSubmit = async (stepData) => {
    setLocalError(null);
    const updatedFormData = { ...formData, ...stepData };
    setFormData(updatedFormData);
    if (step === 1) {
      setLocalLoading(true);
      try {
        const signupRes = await dispatch(signup({
          fullName: updatedFormData.fullName,
          email: updatedFormData.email,
          password: updatedFormData.password,
          role: 'ROLE_STORE_ADMIN',
        })).unwrap();
        if (signupRes && signupRes.jwt) {
          localStorage.setItem('jwt', signupRes.jwt);
        }
        setFadeIn(false);
        setTimeout(() => {
          setStep(2);
          setFadeIn(true);
        }, 150);
      } catch (err) {
        setLocalError(err || 'Signup failed');
      }
      setLocalLoading(false);
    } else if (step === 2) {
      setLocalLoading(true);
      try {
        // Send nested contact object matching Backend StoreDTO.java
        await dispatch(createStore({
          brand: updatedFormData.storeName,
          storeType: updatedFormData.storeType,
          description: `${updatedFormData.storeName} - ${updatedFormData.storeType}`,
          contact: {
            address: updatedFormData.storeAddress,
            email: updatedFormData.email || undefined,
          },
        })).unwrap();
        await dispatch(getUserProfile(localStorage.getItem('jwt'))).unwrap();
        navigate('/store');
      } catch (err) {
        setLocalError(err || 'Store creation failed');
      }
      setLocalLoading(false);
    }
  };

  const handleStepBack = () => {
    if (step > 1) {
      setFadeIn(false);
      setTimeout(() => {
        setStep(step - 1);
        setFadeIn(true);
      }, 150);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <OwnerDetailsForm
            initialValues={{
              fullName: formData.fullName,
              email: formData.email,
              password: formData.password,
              confirmPassword: formData.confirmPassword,
            }}
            onSubmit={handleStepSubmit}
            onBack={handleStepBack}
          />
        );
      case 2:
        return (
          <StoreDetailsForm
            initialValues={{
              storeName: formData.storeName,
              storeType: formData.storeType,
              storeAddress: formData.storeAddress,
            }}
            onSubmit={handleStepSubmit}
            onBack={handleStepBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="flex min-h-screen">
        {/* Mobile Header */}
        <div className="lg:hidden absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-emerald-700 text-white p-6 z-20">
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">
              Welcome to Your POS System
            </h1>
            <p className="text-white/80 text-sm">
              Set up your business profile in minutes
            </p>
          </div>
        </div>

        {/* Left Side */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 via-[#047857] to-[#022c22] relative overflow-hidden">
          <div className="relative z-10 flex flex-col justify-center items-center text-white px-12 w-full">
            <div className="text-center max-w-md">
              <div className="mb-8">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>

              <h1 className="text-4xl font-bold mb-6 leading-tight">
                Welcome to Your
                <span className="block text-yellow-300">POS System</span>
              </h1>

              <p className="text-lg text-white/85 mb-8 leading-relaxed">
                Set up your business profile and start managing your store efficiently.
                It only takes a few minutes to get everything configured.
              </p>

              <div className="space-y-4 text-left">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white/90">Easy inventory management</span>
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white/90">Real-time sales tracking</span>
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white/90">Secure payment processing</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form Section */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-8 pt-36 lg:pt-8 lg:h-screen lg:overflow-y-auto relative">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Step {step} of 2
                </h2>
                <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {step === 1 ? 'Owner Details' : 'Store Details'}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-600 to-[#022c22] h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(step / 2) * 100}%` }}
                ></div>
              </div>
            </div>

            {localError && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg shadow-sm">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {typeof localError === 'string'
                    ? localError
                    : (localError?.message || 'An unexpected error occurred')}
                </div>
              </div>
            )}

            {localLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-50">
                <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}

            <Card className="w-full shadow-xl border bg-card/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-foreground">
                  {step === 1 ? 'Create Your Account' : 'Store Information'}
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  {step === 1
                    ? "Let's start by setting up your account details"
                    : 'Tell us about your business'
                  }
                </p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    fadeIn ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
                  }`}
                >
                  {renderStep()}
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <a href="/auth/login" className="text-primary hover:underline font-medium">
                  Sign in here
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
