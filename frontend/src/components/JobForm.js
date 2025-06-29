import React, { useState } from 'react';
import { X, Globe, User, AlertCircle, CheckCircle } from 'lucide-react';

const JobForm = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    url: '',
    profile_username: ''
  });
  const [isValidUrl, setIsValidUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validateTikTokUrl = (url) => {
    const patterns = [
      /^https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/(?:www\.)?tiktok\.com\/t\/\w+/,
      /^https?:\/\/vm\.tiktok\.com\/\w+/,
      /^https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+/,
    ];
    return patterns.some(pattern => pattern.test(url.trim()));
  };

  const extractUsername = (url) => {
    try {
      if (url.includes('/@')) {
        return url.split('/@')[1].split('/')[0].split('?')[0];
      }
      return '';
    } catch {
      return '';
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, url }));
    
    if (url) {
      const isValid = validateTikTokUrl(url);
      setIsValidUrl(isValid);
      
      if (isValid) {
        const username = extractUsername(url);
        if (username && !formData.profile_username) {
          setFormData(prev => ({ ...prev, profile_username: username }));
        }
        setErrors(prev => ({ ...prev, url: null }));
      } else {
        setErrors(prev => ({ ...prev, url: 'Please enter a valid TikTok URL' }));
      }
    } else {
      setIsValidUrl(null);
      setErrors(prev => ({ ...prev, url: null }));
    }
  };

  const handleUsernameChange = (e) => {
    setFormData(prev => ({ ...prev, profile_username: e.target.value }));
    setErrors(prev => ({ ...prev, profile_username: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    
    if (!formData.url.trim()) {
      newErrors.url = 'TikTok URL is required';
    } else if (!validateTikTokUrl(formData.url)) {
      newErrors.url = 'Please enter a valid TikTok URL';
    }
    
    if (!formData.profile_username.trim()) {
      newErrors.profile_username = 'Profile username is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        url: formData.url.trim(),
        profile_username: formData.profile_username.trim()
      });
      // Form will be closed by parent component on success
    } catch (error) {
      console.error('Job creation error:', error);
      // Error is handled by parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  const exampleUrls = [
    'https://www.tiktok.com/@username',
    'https://www.tiktok.com/@username/video/1234567890',
    'https://tiktok.com/t/shortcode',
    'https://vm.tiktok.com/shortcode'
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Create New Scraping Job
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* TikTok URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <Globe className="h-4 w-4 mr-2" />
                TikTok Profile URL
              </div>
            </label>
            <div className="relative">
              <input
                type="url"
                id="url"
                value={formData.url}
                onChange={handleUrlChange}
                placeholder="https://www.tiktok.com/@username"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.url 
                    ? 'border-red-300 bg-red-50' 
                    : isValidUrl === true 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {isValidUrl === true && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              )}
              {isValidUrl === false && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
              )}
            </div>
            {errors.url && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.url}
              </p>
            )}
          </div>

          {/* Profile Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                Profile Username
              </div>
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                value={formData.profile_username}
                onChange={handleUsernameChange}
                placeholder="username"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.profile_username ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">@</span>
              </div>
            </div>
            {errors.profile_username && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.profile_username}
              </p>
            )}
          </div>

          {/* Example URLs */}
          <div className="bg-gray-50 rounded-md p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Supported URL formats:
            </h4>
            <ul className="space-y-1">
              {exampleUrls.map((url, index) => (
                <li key={index} className="text-xs text-gray-600 font-mono">
                  {url}
                </li>
              ))}
            </ul>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !isValidUrl}
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </div>
              ) : (
                'Create Job'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobForm; 