const { Factory } = require('../model/factoryModel');
const response = require('../utils/response');

class FactoryConfig {
  // Create a new factory configuration
  async create(req, res) {
    try {
      const factory = new Factory(req.body);
      const savedFactory = await factory.save();
      return response.created(res, 'Factory configuration created successfully', savedFactory);
    } catch (error) {
      return response.error(res, error.message);
    }
  }

  // Read all factory configurations
  async getAll(req, res) {
    try {
      const factories = await Factory.find().sort({ createdAt: -1 });
      return response.success(res, 'Factory configurations retrieved successfully', factories);
    } catch (error) {
      return response.error(res, error.message);
    }
  }

  // Read single factory configuration by ID
  async getById(req, res) {
    try {
      const factory = await Factory.findById(req.params.id);
      if (!factory) {
        return response.notFound(res, 'Factory configuration not found');
      }
      return response.success(res, 'Factory configuration retrieved successfully', factory);
    } catch (error) {
      return response.error(res, error.message);
    }
  }

  // Update factory configuration
  async update(req, res) {
    try {
      const factory = await Factory.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );
      if (!factory) {
        return response.notFound(res, 'Factory configuration not found');
      }
      return response.success(res, 'Factory configuration updated successfully', factory);
    } catch (error) {
      return response.error(res, error.message);
    }
  }

  // Delete factory configuration
  async delete(req, res) {
    try {
      const factory = await Factory.findByIdAndDelete(req.params.id);
      if (!factory) {
        return response.notFound(res, 'Factory configuration not found');
      }
      return response.success(res, 'Factory configuration deleted successfully');
    } catch (error) {
      return response.error(res, error.message);
    }
  }
}

module.exports = new FactoryConfig();